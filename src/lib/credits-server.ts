import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { visitors } from "@/lib/db/schema";
import { levelOf } from "@/lib/achievements";

/**
 * AI 积分（✦）服务端余额操作（禁止客户端引入——依赖 better-sqlite3）。
 * 纯函数定价层见 credits.ts。
 */

/** 当日额度：dailyGrant + 等级加成（player/chat 两个入口共用同一公式） */
function dailyAmount(dailyGrant: number, levelBonusPerLevel: number, xp: number) {
  return Math.max(0, Math.round(dailyGrant + levelOf(xp).level * levelBonusPerLevel));
}

/** 仅保证访客行存在（spend/refund 的兜底）：不发放也不重置。
 *  种子 stats 与 player 路由新访客首见的结果一致（含今日 __visit 标记），
 *  但不带 __credits 标记——之后 ensureDailyCredits 仍会正常补上当日重置。 */
async function ensureVisitorRow(vid: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const seed = JSON.stringify({
    affinityPoints: 3,
    visitDays: 1,
    streak: 1,
    bestStreak: 1,
    __daily: { date: today, counts: { __visit: 1 } },
  });
  await db.run(
    sql`INSERT INTO visitors (id, credits, stats) VALUES (${vid}, 0, ${seed}) ON CONFLICT DO NOTHING`,
  );
}

/** 每日重置：新的一天首次触达把余额「重置」为当日额度（dailyGrant + 等级加成），
 *  而非在旧余额上累加——昨天的剩余不结转，否则余额会一天比一天多。
 *  重置标记存 stats.__credits.date（与 __visit 的访问记账解耦，互不影响）：
 *  - 行不存在 → 插入并直接带当日额度（直奔 /chat 的访客不经过页面埋点）；
 *  - 行存在但 __credits.date 不是今天 → credits 置为当日额度并打上标记；
 *  - 今天已重置过 → 不动（chat 与 player 路由谁先到谁重置，后到的幂等跳过）。
 *  json_extract 对缺失路径返回 NULL，IS NOT 对 NULL 判真 → 无标记的老数据也会正常重置。
 *  返回当前余额与本次是否发生了重置/新建。 */
export async function ensureDailyCredits(
  vid: string,
  dailyGrant: number,
  levelBonusPerLevel: number,
): Promise<{ reset: boolean; balance: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const newAmount = dailyAmount(dailyGrant, levelBonusPerLevel, 0);
  const seed = JSON.stringify({
    affinityPoints: 3,
    visitDays: 1,
    streak: 1,
    bestStreak: 1,
    __daily: { date: today, counts: { __visit: 1 } },
    __credits: { date: today },
  });
  const ins = await db.run(
    sql`INSERT INTO visitors (id, credits, stats) VALUES (${vid}, ${newAmount}, ${seed}) ON CONFLICT DO NOTHING`,
  );
  if ((ins.changes ?? 0) > 0) return { reset: true, balance: newAmount };

  // 老访客：按真实 xp 算等级加成，只在新的一天重置（SQL 端原子判定，防并发双发）
  const rows = await db.select({ xp: visitors.xp }).from(visitors).where(eq(visitors.id, vid)).limit(1);
  const amount = dailyAmount(dailyGrant, levelBonusPerLevel, rows[0]?.xp ?? 0);
  const mark = JSON.stringify({ date: today });
  const upd = await db.run(sql`
    UPDATE visitors
    SET credits = ${amount},
        stats = json_set(stats, '$.__credits', json(${mark}))
    WHERE id = ${vid} AND json_extract(stats, '$.__credits.date') IS NOT ${today}
  `);
  if ((upd.changes ?? 0) > 0) return { reset: true, balance: amount };
  return { reset: false, balance: await getBalance(vid) };
}

/**
 * 原子扣减：credits >= cost 才减，返回是否成功与扣后余额。
 * 失败（余额不足/不存在）不产生任何写入副作用。
 */
export async function spendCredits(vid: string, cost: number): Promise<{ ok: boolean; balance: number }> {
  if (cost <= 0) return { ok: true, balance: await getBalance(vid) };
  await ensureVisitorRow(vid);
  const r = await db.run(
    sql`UPDATE visitors SET credits = credits - ${cost} WHERE id = ${vid} AND credits >= ${cost}`,
  );
  if ((r.changes ?? 0) > 0) return { ok: true, balance: await getBalance(vid) };
  return { ok: false, balance: await getBalance(vid) };
}

/** 退款：上游未产生任何 token 的失败场景把扣掉的积分加回去 */
export async function refundCredits(vid: string, cost: number): Promise<void> {
  if (cost <= 0) return;
  await ensureVisitorRow(vid);
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
