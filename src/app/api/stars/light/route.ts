import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { stars, starLights } from "@/lib/db/schema";
import { clientIp } from "@/lib/shared/rate-limit";
import { assertSameOrigin, publicWriteErrorResponse, quotaResponse } from "@/lib/public-write/guard";
import { attachAnonymousVisitorCookie, resolveAnonymousVisitor } from "@/lib/public-write/identity";
import { readJson } from "@/lib/public-write/json";
import { burstQuota, persistentQuota } from "@/lib/public-write/quota";
import { starLightSchema } from "@/lib/public-write/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/stars/light —— 给一颗留声星「回一束光」。
 * 同一访客对同一颗星只能回一次（star_lights 的 unique(starId, visitorId) +
 * ON CONFLICT DO NOTHING 天然去重）；每访客每天最多 20 次（防刷）。
 * 返回该星的最新回光总数（前台就地更新弹卡计数）。
 */
export async function POST(request: Request) {
  let body;
  try {
    assertSameOrigin(request);
    body = await readJson(request, starLightSchema);
  } catch (error) {
    return publicWriteErrorResponse(error) ?? NextResponse.json({ error: "internal" }, { status: 500 });
  }
  const session = await resolveAnonymousVisitor(request, body.visitorId);
  const visitorId = session.visitorId;
  const starId = body.starId;
  const ip = clientIp(request);
  const burst = burstQuota("star-light", "ip", ip, 30, 60_000);
  const visitorDaily = persistentQuota("star-light", "visitor", visitorId, 20, 24 * 60 * 60_000);
  const ipDaily = persistentQuota("star-light", "ip", ip, 100, 24 * 60 * 60_000);
  if (!burst.ok || !visitorDaily.ok || !ipDaily.ok) {
    return attachAnonymousVisitorCookie(
      quotaResponse(Math.max(burst.retryAfter, visitorDaily.retryAfter, ipDaily.retryAfter)),
      request,
      session,
    );
  }

  // 星必须存在且未被软删
  const [star] = await db
    .select({ id: stars.id })
    .from(stars)
    .where(and(eq(stars.id, starId), isNull(stars.deletedAt)))
    .limit(1);
  if (!star) {
    return attachAnonymousVisitorCookie(
      NextResponse.json({ error: "star not found" }, { status: 404 }),
      request,
      session,
    );
  }

  await db.insert(starLights).values({ starId, visitorId }).onConflictDoNothing();

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(starLights)
    .where(eq(starLights.starId, starId));
  return attachAnonymousVisitorCookie(
    NextResponse.json({ ok: true, lights: Number(countRow?.n ?? 0) }),
    request,
    session,
  );
}
