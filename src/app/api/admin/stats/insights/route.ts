import { requireAdminApi } from "@/lib/auth/admin-session";
import { clientIp, rateLimit } from "@/lib/shared/rate-limit";
import { incrStat } from "@/lib/analytics/stats";
import { llmConfigured } from "@/lib/ai/completions";
import { buildAdminStatsPayload } from "@/lib/analytics/admin-stats";
import { generateInsights } from "@/lib/ai/insights";

export const dynamic = "force-dynamic";

/** AI 数据解读（后台专用）：按 range 聚合数据生成自然语言小结 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }
  const rl = rateLimit(`insights:${clientIp(request)}`, 3, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: `太快了，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  if (!(await llmConfigured())) {
    return Response.json({ error: "未配置 AI 模型，无法生成解读" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { range?: unknown } | null;
  const range = Math.min(Math.max(Number(body?.range) || 30, 1), 365);
  const payload = await buildAdminStatsPayload(range);
  const r = await generateInsights(payload);
  if (!r.ok) {
    return Response.json({ error: r.error }, { status: r.status });
  }
  void incrStat("ai_tool", "数据解读");
  return Response.json({ text: r.text, generatedAt: new Date().toISOString() });
}
