import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bottles } from "@/lib/db/schema";
import { attachAnonymousVisitorCookie, resolveAnonymousVisitor } from "@/lib/public-write/identity";
import { logError } from "@/lib/shared/logger";

export const dynamic = "force-dynamic";

/** GET /api/bottles?visitorId=xxx —— 我的漂流瓶（最新 200 只,只读接口,写入走留星/成就/节日结算） */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const session = await resolveAnonymousVisitor(request, searchParams.get("visitorId"));
    const rows = await db
      .select()
      .from(bottles)
      .where(eq(bottles.visitorId, session.visitorId))
      .orderBy(desc(bottles.id))
      .limit(200);
    return attachAnonymousVisitorCookie(NextResponse.json({ bottles: rows }), request, session);
  } catch (err) {
    // DB 故障时给结构化 500（失败响应无 session 可附加 cookie，下次请求会重新解析身份）
    logError("bottles/get", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
