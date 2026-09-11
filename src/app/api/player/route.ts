import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { visitors } from "@/lib/db/schema";
import { incrStat } from "@/lib/stats";
import { getLocale } from "@/lib/i18n/server";
import { getSiteConfig } from "@/lib/site";
import {
  EMPTY_STATS,
  XP_RULES,
  DAILY_CAPS,
  levelOf,
  levelTitle,
  normalizeStats,
  unlockedAchievements,
  type PlayerStats,
  type XpEvent,
} from "@/lib/achievements";
import { creditsCfg } from "@/lib/credits";
import { ensureDailyCredits } from "@/lib/credits-server";
import { logError } from "@/lib/logger";
import { grantBottle, themeFromMeta } from "@/lib/bottles";
import { festivalOf, isYearEndWindow } from "@/lib/festivals";

export const dynamic = "force-dynamic";

interface DayCounter {
  date: string;
  counts: Record<string, number>;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** 本地时区的日期差（按天算，不看时分秒） */
function daysBetween(a: Date, b: Date) {
  const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86_400_000);
}

/**
 * 每次请求结算一次「到访」：时段统计 + 累计天数 + 连续天数。
 * 用 daily.counts.__visit 做当天去重 —— 否则一次浏览里每个埋点都会 +1，
 * 夜访次数会被灌水成几十次。
 * 返回是否为当日首见（供节日发瓶判定）。
 */
function touchVisit(stats: PlayerStats, daily: DayCounter, lastSeen: Date | null): boolean {
  if (daily.counts.__visit) return false;
  daily.counts.__visit = 1;
  stats.affinityPoints += 3; // 每日首见：好感 +3（去重由 __visit 保证）

  const now = new Date();
  const h = now.getHours();
  if (h < 5) stats.nightVisits += 1;
  else if (h < 8) stats.dawnVisits += 1;

  if (!lastSeen) {
    stats.visitDays = 1;
    stats.streak = 1;
    stats.bestStreak = Math.max(stats.bestStreak, 1);
    return true;
  }
  const diff = daysBetween(lastSeen, now);
  if (diff <= 0) return true; // 同一天，天数不动
  stats.visitDays += 1;
  stats.streak = diff === 1 ? stats.streak + 1 : 1; // 断签则重新从 1 开始
  stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  return true;
}

/** 结算一个行为事件：更新统计/经验/单日计数，返回新进度 */
function applyEvent(stats: PlayerStats, daily: DayCounter, event: XpEvent, payload?: Record<string, unknown>) {
  let gained = 0;
  const cap = DAILY_CAPS[event];
  const already = daily.counts[event] ?? 0;
  if (cap === undefined || already < cap) {
    gained = XP_RULES[event];
    daily.counts[event] = already + 1;
  }

  switch (event) {
    case "read_post": {
      const id = Number(payload?.postId);
      const ids = new Set(stats.readPostIds ?? []);
      if (Number.isFinite(id) && !ids.has(id)) {
        ids.add(id);
        // postsRead 独立累计：readPostIds 只留最近 50 条做近期去重，
        // 若写作 ids.size 会封顶在 51，reader_100+ 永远无法解锁。
        // 已知偏差：重读 50 篇之前的旧文会多计一次，客户端
        // cl-read-posts（留 100 条）兜底，成就阈值判定宁可宽松。
        stats.postsRead += 1;
        stats.readPostIds = [...ids].slice(-50);
      }
      break;
    }
    case "play_music":
      stats.songsPlayed += 1;
      // 统计面板：按歌名记一次播放（聚合存储，见 lib/stats.ts）
      void incrStat("music_play", String(payload?.title ?? "").slice(0, 80));
      break;
    case "switch_accent": {
      const a = String(payload?.accent ?? "");
      if (a && !stats.accentsTried.includes(a)) stats.accentsTried = [...stats.accentsTried, a].slice(-10);
      break;
    }
    case "find_egg":
      stats.eggFound = true;
      break;
    case "leave_star":
      stats.starsLeft += 1;
      break;
    case "visit_lab":
      stats.labVisits += 1;
      break;
    case "visit_lab_demo": {
      stats.labDemos += 1;
      // 玩过的实验 slug 去重留最近 10 个（demo_all 判定用，仿 readPostIds）
      const demoId = String(payload?.demoId ?? "").slice(0, 32);
      if (demoId && !(stats.labDemoIds ?? []).includes(demoId)) {
        stats.labDemoIds = [...(stats.labDemoIds ?? []), demoId].slice(-10);
      }
      break;
    }
    case "light_star":
      // 回一束光：去重在 star_lights 表（API 层），这里只累计次数
      stats.lightsGiven += 1;
      break;
    case "like_post":
      // 文章点赞：去重在 post_likes 表（API 层），这里只累计次数
      stats.postLikesGiven += 1;
      break;
    case "use_chat":
      stats.chatUsed += 1;
      if (gained > 0) stats.affinityPoints += 2; // 好感随聊天累积（受 use_chat 单日上限防刷）
      break;
    case "toggle_theme":
    case "set_theme_mode": // 三态切换与旧 toggle 同计一份统计
      stats.themeToggles += 1;
      break;
    case "use_search":
      stats.searchUsed += 1;
      break;
    case "open_calendar":
      stats.calendarOpens += 1;
      break;
    case "switch_locale": {
      const l = String(payload?.locale ?? "");
      if (l && !stats.localesTried.includes(l)) stats.localesTried = [...stats.localesTried, l].slice(-10);
      break;
    }
    case "poke_sun":
      // 客户端把快速连点合并成一个 { count } 上报（防并发丢计数），
      // 单次最多认 50 下，防伪造payload灌水
      stats.sunClicks += Math.min(50, Math.max(1, Math.floor(Number(payload?.count)) || 1));
      break;
    case "visit_planet": {
      stats.planetClicks += 1;
      const p = String(payload?.planetId ?? "");
      if (p && !(stats.planetIds ?? []).includes(p)) {
        stats.planetIds = [...(stats.planetIds ?? []), p].slice(-20);
      }
      break;
    }
    case "view_star":
      stats.starViews += 1;
      break;
    case "pat_mascot":
      stats.mascotPats += 1;
      if (gained > 0) stats.affinityPoints += 2; // 摸头 +2（受单日上限防刷）
      break;
    case "daily_checkin":
      // gained > 0 说明今日首次签到（DAILY_CAPS 限 1 次/天）
      if (gained > 0) stats.checkinDays += 1;
      break;
  }
  return gained;
}

/** POST /api/player —— body: { visitorId, event, payload? } */
export async function POST(request: Request) {
  const locale = await getLocale();
  const body = (await request.json().catch(() => null)) as {
    visitorId?: string;
    event?: XpEvent;
    payload?: Record<string, unknown>;
    __meta?: { theme?: unknown };
  } | null;

  const visitorId = (body?.visitorId ?? "").trim();
  const event = body?.event;
  if (!visitorId || visitorId.length > 64 || !event || !(event in XP_RULES)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  /* ===== AI 积分（✦）每日重置（必须在 stats 事务之前） =====
   * 新的一天首次触达（chat / player 路由谁先到谁触发）：余额「重置」为
   * dailyGrant + 等级加成——昨天的剩余不结转，不能每天 +500 累上去。
   * 顺序约束：下面的事务会把 __credits 标记写回 stats，若先写标记后重置，
   * ensureDailyCredits 会误判"今天已重置"而跳过，当日额度就丢了。 */
  const creditCfg = creditsCfg((await getSiteConfig()).aiChat);
  let creditsBase = 0;
  if (creditCfg.enabled) {
    creditsBase = (await ensureDailyCredits(visitorId, creditCfg.dailyGrant, creditCfg.levelBonusPerLevel)).balance;
  }

  /* ===== stats/xp 结算：同步事务 =====
   * 旧实现「await 读 → 计算 → await 写」之间存在微任务让出点，两个并发埋点
   * 的续体会交错，后写者用旧 stats 整包覆盖先写者（丢更新：XP 丢失、单日
   * 上限计数失真）。better-sqlite3 的事务回调要求全程同步（见 admin/import
   * 路由同款模式与注释）：回调执行期间事件循环无法插入其他请求，读-算-写
   * 在结构上原子；任何一步抛错整体回滚，不再出现写一半的中间态。
   * credits 列不经此事务：重置由 ensureDailyCredits 的 SQL 原子 CAS 完成，
   * 签到加成在事务后原子累加——避免绝对值覆盖踩掉并发的扣减/退款。 */
  const r = db.$client.transaction(() => {
    const rows = db.select().from(visitors).where(eq(visitors.id, visitorId)).limit(1).all();
    const existing = rows[0];

    /* 直接从解析后的对象里取 __daily。
       旧实现用正则从 JSON 字符串里抠（/"__daily":\s*(\{[^}]*\})/），
       但 [^}]* 会在内层 counts 的 } 处就停下，抠出来永远是不闭合的片段，
       JSON.parse 必抛错 → 每次都回落到新计数器 → 单日上限形同虚设。 */
    const raw = existing
      ? (JSON.parse(existing.stats) as Partial<PlayerStats> & { __daily?: DayCounter })
      : null;
    const { __daily, ...rest } = raw ?? {};
    const stats: PlayerStats = normalizeStats(rest);
    const daily: DayCounter =
      __daily && __daily.date === today() ? __daily : { date: today(), counts: {} };

    // 成就 diff 的基线要含 touchVisit 之前的状态（夜之住民等首见成就也算"本次解锁"）
    const beforeKeys = new Set(unlockedAchievements(stats));
    const firstVisitToday = touchVisit(stats, daily, existing?.lastSeen ?? null);
    const gained = applyEvent(stats, daily, event, body?.payload);
    const xp = (existing?.xp ?? 0) + gained;

    // stats 里捎带当日计数与积分重置标记（简单起见存同列）；
    // __credits 标记必须写回，否则整包 UPSERT 会把 ensureDailyCredits
    // 刚打上的标记抹掉，导致同日第二次触达被再重置一次
    const statsWithDaily = {
      ...stats,
      __daily: daily,
      ...(creditCfg.enabled ? { __credits: { date: today() } } : {}),
    } as unknown as PlayerStats & { __daily: DayCounter; __credits?: { date: string } };

    db.insert(visitors)
      .values({ id: visitorId, xp, stats: JSON.stringify(statsWithDaily) })
      .onConflictDoUpdate({
        target: visitors.id,
        set: {
          xp,
          stats: JSON.stringify(statsWithDaily),
          lastSeen: new Date(),
        },
      })
      .run();

    return { gained, xp, stats, beforeKeys, firstVisitToday, credits: existing?.credits ?? 0 };
  })();

  // 当日首次签到 +checkinBonus（加成而非重置；DAILY_CAPS 限 1 次/天）
  let creditsGain = 0;
  if (creditCfg.enabled && event === "daily_checkin" && r.gained > 0) {
    creditsGain = creditCfg.checkinBonus;
    await db.run(sql`UPDATE visitors SET credits = credits + ${creditsGain} WHERE id = ${visitorId}`);
  }
  const creditsBalance = creditCfg.enabled ? creditsBase + creditsGain : r.credits;

  // ===== 漂流瓶（幂等，失败不阻断结算）=====
  const theme = themeFromMeta(body?.__meta);
  try {
    if (r.firstVisitToday) {
      // 当日首见撞上节气/农历节日 → 封一只节日限定瓶
      const fest = festivalOf(new Date());
      if (fest) await grantBottle(visitorId, "festival", fest.key, theme);
      // 年末开瓶夜（12/25–12/31）：窗口内任意一天首见 → 跨年纪念瓶（refKey=年份，一年一只）
      if (isYearEndWindow()) {
        await grantBottle(visitorId, "newyear", String(new Date().getFullYear()), theme);
      }
    }
    // 本次新解锁的成就逐个封瓶（纪念瓶）
    for (const key of unlockedAchievements(r.stats)) {
      if (!r.beforeKeys.has(key)) await grantBottle(visitorId, "achievement", key, theme);
    }
  } catch (err) {
    // 发瓶失败不阻断结算，但要有迹可循（此前静默吞掉，线上无从排查）
    logError("player/bottles", err, { event });
  }

  const lvl = levelOf(r.xp);
  return NextResponse.json({
    xp: r.xp,
    gained: r.gained,
    level: lvl.level,
    title: levelTitle(lvl.level, locale),
    progress: lvl.progress,
    tier: lvl.tier,
    achievements: unlockedAchievements(r.stats),
    stats: r.stats,
    credits: creditsBalance,
  });
}

/** GET /api/player?visitorId=xxx —— 查询进度 */
export async function GET(request: Request) {
  const locale = await getLocale();
  const { searchParams } = new URL(request.url);
  const visitorId = (searchParams.get("visitorId") ?? "").trim();
  if (!visitorId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const rows = await db.select().from(visitors).where(eq(visitors.id, visitorId)).limit(1);
  const row = rows[0];
  if (!row) {
    const lvl = levelOf(0);
    return NextResponse.json({
      xp: 0,
      level: lvl.level,
      title: levelTitle(1, locale),
      progress: 0,
      tier: lvl.tier,
      achievements: [],
      stats: EMPTY_STATS,
      credits: 0,
    });
  }
  // 老访客的 stats 里没有新字段，normalizeStats 补齐默认值，否则 check() 会读到 undefined
  const raw = JSON.parse(row.stats) as Partial<PlayerStats> & { __daily?: unknown; __credits?: unknown };
  delete raw.__daily;
  delete raw.__credits;
  const stats = normalizeStats(raw);
  const lvl = levelOf(row.xp);
  return NextResponse.json({
    xp: row.xp,
    level: lvl.level,
    title: levelTitle(lvl.level, locale),
    progress: lvl.progress,
    tier: lvl.tier,
    achievements: unlockedAchievements(stats),
    stats,
    credits: row.credits ?? 0,
  });
}
