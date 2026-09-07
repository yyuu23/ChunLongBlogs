import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { visitors } from "@/lib/db/schema";

/**
 * AI 积分（✦）服务端余额操作（禁止客户端引入——依赖 better-sqlite3）。
 * 纯函数定价层见 credits.ts。
 */

/** 确保访客行存在；新行直接带当日额度（500+等级加成由调用方算好传入）。
 *  直奔 /chat 发消息的访客不经过页面埋点，否则 0 余额会被积分扣减直接拒掉。
 *  种子 stats 带上「今日已访问」标记与 visitDays 初值——player 路由同日的
 *  首见发放/好感 +3 会因标记已存在而跳过，避免与这里双重发放。已有行不做任何事。 */
export async function ensureVisitorWithGrant(vid: string, startingCredits: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const seed = JSON.stringify({
    affinityPoints: 3,
    visitDays: 1,
    streak: 1,
    bestStreak: 1,
    __daily: { date: today, counts: { __visit: 1 } },
  });
  await db.run(
    sql`INSERT INTO visitors (id, credits, stats) VALUES (${vid}, ${Math.max(0, Math.round(startingCredits))}, ${seed}) ON CONFLICT DO NOTHING`,
  );
}

/**
 * 原子扣减：credits >= cost 才减，返回是否成功与扣后余额。
 * 失败（余额不足/不存在）不产生任何写入副作用。
 */
export async function spendCredits(vid: string, cost: number): Promise<{ ok: boolean; balance: number }> {
  if (cost <= 0) return { ok: true, balance: await getBalance(vid) };
  await ensureVisitorWithGrant(vid, 0);
  const r = await db.run(
    sql`UPDATE visitors SET credits = credits - ${cost} WHERE id = ${vid} AND credits >= ${cost}`,
  );
  if ((r.changes ?? 0) > 0) return { ok: true, balance: await getBalance(vid) };
  return { ok: false, balance: await getBalance(vid) };
}

/** 退款：上游未产生任何 token 的失败场景把扣掉的积分加回去 */
export async function refundCredits(vid: string, cost: number): Promise<void> {
  if (cost <= 0) return;
  await ensureVisitorWithGrant(vid, 0);
  await db.run(sql`UPDATE visitors SET credits = credits + ${cost} WHERE id = ${vid}`);
}

export async function getBalance(vid: string): Promise<number> {
  try {
    const rows = await db.select({ credits: visitors.credits }).from(visitors).where(eq(visitors.id, vid)).limit(1);
    return rows[0]?.credits ?? 0;
  } catch {
    return 0;
  }
}
