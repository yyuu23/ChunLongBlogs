import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { suggestSlug } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** AI 生成英文 URL slug（后台专用）：编辑器"AI 生成 slug"按钮调用 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rl = rateLimit(`suggest-slug:${clientIp(request)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `太快了，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    content?: unknown;
  } | null;
  if (typeof body?.title !== "string" || typeof body?.content !== "string") {
    return NextResponse.json(
      { error: "请求格式错误：title 与 content 应为字符串" },
      { status: 400 },
    );
  }

  const r = await suggestSlug(body.title, body.content);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ slug: r.slug });
}
