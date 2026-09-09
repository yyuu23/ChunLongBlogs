import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bottles } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/bottles/open —— 开瓶仪式（不可逆）。
 * 属主校验 + WHERE opened_at IS NULL 原子开瓶：重复开幂等返回 already，
 * 并发开也只有一次生效。开瓶后：液体剩四成、节气瓶的站长信笺可读。
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { visitorId?: string; bottleId?: number } | null;
  const visitorId = (body?.visitorId ?? "").trim().slice(0, 64);
  const bottleId = Number(body?.bottleId);
  if (!visitorId || !Number.isInteger(bottleId) || bottleId <= 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const [row] = await db
    .update(bottles)
    .set({ openedAt: new Date() })
    .where(and(eq(bottles.id, bottleId), eq(bottles.visitorId, visitorId), isNull(bottles.openedAt)))
    .returning({ id: bottles.id, openedAt: bottles.openedAt });

  if (row) return NextResponse.json({ ok: true, openedAt: row.openedAt });

  // 没更新到：要么不是你的瓶，要么已经开过——区分返回
  const [existing] = await db
    .select({ id: bottles.id, openedAt: bottles.openedAt })
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.visitorId, visitorId)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, already: true, openedAt: existing.openedAt });
}
