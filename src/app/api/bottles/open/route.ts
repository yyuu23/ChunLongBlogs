import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bottles } from "@/lib/db/schema";
import { clientIp } from "@/lib/shared/rate-limit";
import { assertSameOrigin, publicWriteErrorResponse, quotaResponse } from "@/lib/public-write/guard";
import { attachAnonymousVisitorCookie, resolveAnonymousVisitor } from "@/lib/public-write/identity";
import { readJson } from "@/lib/public-write/json";
import { burstQuota } from "@/lib/public-write/quota";
import { bottleOpenSchema } from "@/lib/public-write/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/bottles/open —— 开瓶仪式（不可逆）。
 * 属主校验 + WHERE opened_at IS NULL 原子开瓶：重复开幂等返回 already，
 * 并发开也只有一次生效。开瓶后：液体剩四成、节气瓶的站长信笺可读。
 */
export async function POST(request: Request) {
  let body;
  try {
    assertSameOrigin(request);
    body = await readJson(request, bottleOpenSchema);
  } catch (error) {
    return publicWriteErrorResponse(error) ?? NextResponse.json({ error: "internal" }, { status: 500 });
  }
  const session = await resolveAnonymousVisitor(request, body.visitorId);
  const ipLimit = burstQuota("bottle-open", "ip", clientIp(request), 30, 60_000);
  const visitorLimit = burstQuota("bottle-open", "visitor", session.visitorId, 30, 60_000);
  if (!ipLimit.ok || !visitorLimit.ok) {
    return attachAnonymousVisitorCookie(
      quotaResponse(Math.max(ipLimit.retryAfter, visitorLimit.retryAfter)),
      request,
      session,
    );
  }
  const visitorId = session.visitorId;
  const bottleId = body.bottleId;

  const [row] = await db
    .update(bottles)
    .set({ openedAt: new Date() })
    .where(and(eq(bottles.id, bottleId), eq(bottles.visitorId, visitorId), isNull(bottles.openedAt)))
    .returning({ id: bottles.id, openedAt: bottles.openedAt });

  if (row) {
    return attachAnonymousVisitorCookie(NextResponse.json({ ok: true, openedAt: row.openedAt }), request, session);
  }

  // 没更新到：要么不是你的瓶，要么已经开过——区分返回
  const [existing] = await db
    .select({ id: bottles.id, openedAt: bottles.openedAt })
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.visitorId, visitorId)))
    .limit(1);
  if (!existing) {
    return attachAnonymousVisitorCookie(
      NextResponse.json({ error: "not found" }, { status: 404 }),
      request,
      session,
    );
  }
  return attachAnonymousVisitorCookie(
    NextResponse.json({ ok: true, already: true, openedAt: existing.openedAt }),
    request,
    session,
  );
}
