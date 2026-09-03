import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { visitors } from "@/lib/db/schema";
import { getLocale } from "@/lib/i18n/server";
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
 */
function touchVisit(stats: PlayerStats, daily: DayCounter, lastSeen: Date | null) {
  if (daily.counts.__visit) return;
  daily.counts.__visit = 1;

  const now = new Date();
  const h = now.getHours();
  if (h < 5) stats.nightVisits += 1;
  else if (h < 8) stats.dawnVisits += 1;

  if (!lastSeen) {
    stats.visitDays = 1;
    stats.streak = 1;
    stats.bestStreak = Math.max(stats.bestStreak, 1);
    return;
  }
  const diff = daysBetween(lastSeen, now);
  if (diff <= 0) return; // 同一天，天数不动
  stats.visitDays += 1;
  stats.streak = diff === 1 ? stats.streak + 1 : 1; // 断签则重新从 1 开始
  stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
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
    case "use_chat":
      stats.chatUsed += 1;
      break;
    case "toggle_theme":
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
  } | null;

  const visitorId = (body?.visitorId ?? "").trim();
  const event = body?.event;
  if (!visitorId || visitorId.length > 64 || !event || !(event in XP_RULES)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const rows = await db.select().from(visitors).where(eq(visitors.id, visitorId)).limit(1);
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

  touchVisit(stats, daily, existing?.lastSeen ?? null);
  const gained = applyEvent(stats, daily, event, body?.payload);
  const xp = (existing?.xp ?? 0) + gained;

  // stats 里捎带当日计数（简单起见存同列）
  const statsWithDaily = { ...stats, __daily: daily } as unknown as PlayerStats & { __daily: DayCounter };

  await db
    .insert(visitors)
    .values({ id: visitorId, xp, stats: JSON.stringify(statsWithDaily) })
    .onConflictDoUpdate({
      target: visitors.id,
      set: { xp, stats: JSON.stringify(statsWithDaily), lastSeen: new Date() },
    });

  const lvl = levelOf(xp);
  return NextResponse.json({
    xp,
    gained,
    level: lvl.level,
    title: levelTitle(lvl.level, locale),
    progress: lvl.progress,
    tier: lvl.tier,
    achievements: unlockedAchievements(stats),
    stats,
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
    });
  }
  // 老访客的 stats 里没有新字段，normalizeStats 补齐默认值，否则 check() 会读到 undefined
  const raw = JSON.parse(row.stats) as Partial<PlayerStats> & { __daily?: unknown };
  delete raw.__daily;
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
  });
}
