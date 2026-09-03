import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { suggestTitle } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** AI 从正文拟标题（后台专用）：编辑器"AI 起标题"按钮调用 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rl = rateLimit(`suggest-title:${clientIp(request)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `太快了，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  if (typeof body?.content !== "string") {
    return NextResponse.json({ error: "请求格式错误：content 应为字符串" }, { status: 400 });
  }

  const r = await suggestTitle(body.content);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ title: r.title });
}
