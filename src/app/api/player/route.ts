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
        stats.postsRead = ids.size;
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

  const stats: PlayerStats = existing ? { ...EMPTY_STATS, ...(JSON.parse(existing.stats) as Partial<PlayerStats>) } : { ...EMPTY_STATS };
  const daily: DayCounter =
    existing ? (() => {
      try {
        const parsed = JSON.parse((existing.stats as string).match(/"__daily":\s*(\{[^}]*\})/)?.[1] ?? "{}") as DayCounter;
        return parsed.date === today() ? parsed : { date: today(), counts: {} };
      } catch {
        return { date: today(), counts: {} };
      }
    })() : { date: today(), counts: {} };

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
  const stats = { ...EMPTY_STATS, ...(JSON.parse(row.stats) as Partial<PlayerStats>) };
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
