import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { stars, starLights } from "@/lib/db/schema";
import { dailyCount } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/stars/light —— 给一颗留声星「回一束光」。
 * 同一访客对同一颗星只能回一次（star_lights 的 unique(starId, visitorId) +
 * ON CONFLICT DO NOTHING 天然去重）；每访客每天最多 20 次（防刷）。
 * 返回该星的最新回光总数（前台就地更新弹卡计数）。
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { starId?: number; visitorId?: string } | null;
  const starId = Number(body?.starId);
  const visitorId = (body?.visitorId ?? "").trim().slice(0, 64);
  if (!Number.isInteger(starId) || starId <= 0 || !visitorId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // 星必须存在且未被软删
  const [star] = await db
    .select({ id: stars.id })
    .from(stars)
    .where(and(eq(stars.id, starId), isNull(stars.deletedAt)))
    .limit(1);
  if (!star) {
    return NextResponse.json({ error: "star not found" }, { status: 404 });
  }

  if (!dailyCount(`light:${visitorId}`, 20).ok) {
    return NextResponse.json({ error: "too many lights today" }, { status: 429 });
  }

  await db.insert(starLights).values({ starId, visitorId }).onConflictDoNothing();

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(starLights)
    .where(eq(starLights.starId, starId));
  return NextResponse.json({ ok: true, lights: Number(countRow?.n ?? 0) });
}
