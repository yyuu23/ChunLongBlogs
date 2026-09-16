import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { stars, starLights } from "@/lib/db/schema";
import { grantBottle } from "@/lib/bottles";
import { clientIp } from "@/lib/rateLimit";
import { assertSameOrigin, publicWriteErrorResponse, quotaResponse } from "@/lib/public-write/guard";
import { attachAnonymousVisitorCookie, resolveAnonymousVisitor } from "@/lib/public-write/identity";
import { readJson } from "@/lib/public-write/json";
import { burstQuota, persistentQuota } from "@/lib/public-write/quota";
import { starCreateSchema } from "@/lib/public-write/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/stars —— 留声星列表（最新 80 颗 ∪ 该访客自己的星）。
 * ?visitorId= 时自己的星带 mine 标记——即使被 80 颗窗口顶出去也照常返回，
 * 否则访客会"找不到自己留的星"（位置由 id 哈希、形态与普通星无异，
 * 归属信息只能靠接口给出）。软删除的一律不可见。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const session = await resolveAnonymousVisitor(request, searchParams.get("visitorId"));
  const visitorId = session.visitorId;

  const rows = await db
    .select()
    .from(stars)
    .where(isNull(stars.deletedAt))
    .orderBy(desc(stars.id))
    .limit(80);

  // 自己的星（最新 10 颗）：窗口外的补进列表，窗口内的由 rows 覆盖
  const own =
    visitorId
      ? await db
          .select()
          .from(stars)
          .where(and(eq(stars.visitorId, visitorId), isNull(stars.deletedAt)))
          .orderBy(desc(stars.id))
          .limit(10)
      : [];
  const inWindow = new Set(rows.map((s) => s.id));
  const merged = [...rows, ...own.filter((s) => !inWindow.has(s.id))];

  // 回一束光：每颗星的回光总数 + 当前访客是否回过（弹卡展示与按钮状态用）
  const ids = merged.map((s) => s.id);
  const lightCountMap = new Map<number, number>();
  const litByMeSet = new Set<number>();
  if (visitorId && ids.length) {
    const countRows = await db
      .select({ starId: starLights.starId, n: sql<number>`count(*)` })
      .from(starLights)
      .where(inArray(starLights.starId, ids))
      .groupBy(starLights.starId);
    for (const r of countRows) lightCountMap.set(r.starId, Number(r.n));
    const mine = await db
      .select({ starId: starLights.starId })
      .from(starLights)
      .where(and(eq(starLights.visitorId, visitorId), inArray(starLights.starId, ids)));
    for (const r of mine) litByMeSet.add(r.starId);
  }

  return attachAnonymousVisitorCookie(
    NextResponse.json({
      stars: merged.map((s) => ({
        id: s.id,
        content: s.content,
        createdAt: s.createdAt,
        ...(s.visitorId === visitorId ? { mine: true } : {}),
        ...(s.featured ? { featured: true } : {}),
        lights: lightCountMap.get(s.id) ?? 0,
        litByMe: litByMeSet.has(s.id),
      })),
    }),
    request,
    session,
  );
}

/** POST /api/stars —— 留下一颗星（50 字限制 + 每访客 24h 最多 3 条）+ 封存一只漂流瓶 */
export async function POST(request: Request) {
  let body;
  try {
    assertSameOrigin(request);
    body = await readJson(request, starCreateSchema);
  } catch (error) {
    return publicWriteErrorResponse(error) ?? NextResponse.json({ error: "internal" }, { status: 500 });
  }
  const session = await resolveAnonymousVisitor(request, body.visitorId);
  const visitorId = session.visitorId;
  const ip = clientIp(request);
  const burst = burstQuota("star-create", "ip", ip, 5, 10 * 60_000);
  const dailyIp = persistentQuota("star-create", "ip", ip, 10, 24 * 60 * 60_000);
  if (!burst.ok || !dailyIp.ok) {
    return attachAnonymousVisitorCookie(
      quotaResponse(Math.max(burst.retryAfter, dailyIp.retryAfter)),
      request,
      session,
    );
  }
  const content = body.content;

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(stars)
    .where(and(eq(stars.visitorId, visitorId || "anonymous"), gte(stars.createdAt, since)));

  if (Number(countRow?.n ?? 0) >= 3) {
    return attachAnonymousVisitorCookie(
      quotaResponse(24 * 60 * 60, "一天最多留 3 颗星哦，明天再来 ✨"),
      request,
      session,
    );
  }

  const [row] = await db.insert(stars).values({ content, visitorId }).returning();
  // 留星封瓶：瓶里永远留着今天留下的这句话
  await grantBottle(visitorId, "star", row.id, body?.theme, content).catch(() => {});
  return attachAnonymousVisitorCookie(
    NextResponse.json({ star: { id: row.id, content: row.content, createdAt: row.createdAt, mine: true } }),
    request,
    session,
  );
}
