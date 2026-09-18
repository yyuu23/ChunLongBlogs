import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin-session";
import { clientIp, rateLimit } from "@/lib/shared/rate-limit";
import { summarizeContent } from "@/lib/ai/completions";
import { incrStat } from "@/lib/analytics/stats";

export const dynamic = "force-dynamic";

/**
 * AI 生成文章摘要（后台专用）：编辑器"AI 生成摘要"按钮调用。
 * 核心逻辑在 @/lib/ai/completionsSummary（与批量补摘要共用），这里只做鉴权/限流/入参校验。
 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 限流：即便是后台，也防手抖连点把额度打空
  const rl = rateLimit(`summarize:${clientIp(request)}`, 10, 60_000);
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
  // 类型先验：非字符串直接 400，避免下面 .trim() 抛 TypeError 变 500
  if (typeof body?.title !== "string" || typeof body?.content !== "string") {
    return NextResponse.json(
      { error: "请求格式错误：title 与 content 应为字符串" },
      { status: 400 },
    );
  }

  const r = await summarizeContent(body.title.trim(), body.content);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  void incrStat("ai_tool", "生成摘要");
  return NextResponse.json({ summary: r.summary });
}
