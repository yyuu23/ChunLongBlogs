import { and, desc, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { statsDaily, visitorDays } from "@/lib/db/schema";

/**
 * 站点行为统计（按天聚合，无原始流水）：
 * - incrStat：任意埋点 +1（UPSERT），失败静默——统计绝不影响主流程
 * - markVisit：UV 去重标记
 * - 各聚合查询（trafficSeries / metricTop / aiCalls 等）供 admin 面板与导出复用
 */

/** 本地时区当日 YYYY-MM-DD（日界跟随服务器时区，与访客直觉一致） */
export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function incrStat(metric: string, key = "", n = 1): Promise<void> {
  try {
    await db
      .insert(statsDaily)
      .values({ day: localDay(), metric, key, count: n })
      .onConflictDoUpdate({
        target: [statsDaily.day, statsDaily.metric, statsDaily.key],
        set: { count: sql`${statsDaily.count} + ${n}` },
      });
  } catch {
    // 统计失败不影响业务
  }
}

export async function markVisit(visitorId: string): Promise<void> {
  if (!visitorId || visitorId.length > 64) return;
  try {
    await db
      .insert(visitorDays)
      .values({ day: localDay(), visitorId })
      .onConflictDoNothing();
  } catch {}
}

/* ---------- 查询（admin 面板 / 导出共用） ---------- */

export interface TrafficPoint {
  day: string;
  pv: number;
  uv: number;
}

export interface KeyCount {
  key: string;
  count: number;
}

export interface AiCallRow extends KeyCount {
  provider: string;
  model: string;
  effort: string;
}

/** 近 N 天逐日 PV/UV（含空日补零，图表连续） */
export async function trafficSeries(days: number): Promise<TrafficPoint[]> {
  const from = localDay(new Date(Date.now() - (days - 1) * 86_400_000));
  const [pvRows, uvRows] = await Promise.all([
    db
      .select({ day: statsDaily.day, n: sql<number>`sum(${statsDaily.count})` })
      .from(statsDaily)
      .where(and(gte(statsDaily.day, from), sql`${statsDaily.metric} = 'pv'`))
      .groupBy(statsDaily.day),
    db
      .select({ day: visitorDays.day, n: sql<number>`count(*)` })
      .from(visitorDays)
      .where(gte(visitorDays.day, from))
      .groupBy(visitorDays.day),
  ]);
  const pvMap = new Map(pvRows.map((r) => [r.day, Number(r.n) || 0]));
  const uvMap = new Map(uvRows.map((r) => [r.day, Number(r.n) || 0]));
  const out: TrafficPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = localDay(new Date(Date.now() - i * 86_400_000));
    out.push({ day, pv: pvMap.get(day) ?? 0, uv: uvMap.get(day) ?? 0 });
  }
  return out;
}

/** 某 metric 在时间窗内的 key 汇总（count 降序） */
export async function metricTop(metric: string, days: number | "all", limit = 20): Promise<KeyCount[]> {
  const conds = [sql`${statsDaily.metric} = ${metric}`];
  if (days !== "all") {
    conds.push(gte(statsDaily.day, localDay(new Date(Date.now() - (days - 1) * 86_400_000))));
  }
  const rows = await db
    .select({ key: statsDaily.key, n: sql<number>`sum(${statsDaily.count})` })
    .from(statsDaily)
    .where(and(...conds))
    .groupBy(statsDaily.key)
    .orderBy(desc(sql`sum(${statsDaily.count})`))
    .limit(limit);
  return rows.map((r) => ({ key: r.key, count: Number(r.n) || 0 }));
}

/** AI 调用：key 形如 "glm|glm-5.3-flash|low"，拆成结构化行 */
export async function aiCalls(days: number | "all"): Promise<AiCallRow[]> {
  const rows = await metricTop("ai_call", days, 100);
  return rows.map((r) => {
    const [provider = "", model = "", effort = ""] = r.key.split("|");
    return { ...r, provider, model, effort };
  });
}

/** 某指标总量（时间窗） */
export async function metricSum(metric: string, days: number | "all"): Promise<number> {
  const conds = [sql`${statsDaily.metric} = ${metric}`];
  if (days !== "all") {
    conds.push(gte(statsDaily.day, localDay(new Date(Date.now() - (days - 1) * 86_400_000))));
  }
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${statsDaily.count}), 0)` })
    .from(statsDaily)
    .where(and(...conds));
  return Number(row?.n) || 0;
}

/** 累计独立访客数（visitors 表总行数口径的补充：visitor_days 全量去重） */
export async function totalUniqueVisitors(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${visitorDays.visitorId})` })
    .from(visitorDays);
  return Number(row?.n) || 0;
}
