import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { polishMoment, polishPost } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * AI 润色（后台专用）：kind=post 润色整篇 Markdown 文章（保原意，优化结构与表达），
 * kind=moment 把说说改写得更轻松惬意。token 开销大，限流收紧到 5 次/分钟。
 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rl = rateLimit(`polish:${clientIp(request)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `太快了，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    title?: unknown;
    content?: unknown;
  } | null;
  if (body?.kind !== "post" && body?.kind !== "moment") {
    return NextResponse.json({ error: "请求格式错误：kind 应为 post 或 moment" }, { status: 400 });
  }
  if (typeof body?.content !== "string" || (body.kind === "post" && typeof body.title !== "string")) {
    return NextResponse.json(
      { error: body.kind === "post" ? "请求格式错误：title 与 content 应为字符串" : "请求格式错误：content 应为字符串" },
      { status: 400 },
    );
  }

  const r =
    body.kind === "post"
      ? await polishPost(body.title as string, body.content)
      : await polishMoment(body.content);

  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ content: r.content });
}
