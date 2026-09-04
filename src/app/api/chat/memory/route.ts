import { NextResponse } from "next/server";
import { clientIp, rateLimit, dailyCount } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/memory —— 把最近的对话浓缩成长期记忆要点，返回给客户端存它自己的 localStorage。
 * 计入聊天的全局日额度（dailyCount("chat:global")，成本上限统一）；记忆只在响应里走一趟，服务端不落库。
 */
export async function POST(request: Request) {
  // 提取频率本就低（每 4 轮一次），分钟限流从紧
  const rl = rateLimit(`memory:${clientIp(request)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // 与聊天共享每日总额度（记忆提取也是 LLM 成本）
  const dailyLimit = Number(process.env.CHAT_DAILY_LIMIT) || 500;
  const dl = dailyCount("chat:global", dailyLimit);
  if (!dl.ok) {
    return NextResponse.json({ error: "daily limit" }, { status: 429, headers: { "Retry-After": String(dl.resetIn) } });
  }

  const base =
    process.env.LLM_BASE_URL ?? process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com/v1";
  const key = process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  const model = process.env.LLM_MODEL ?? "deepseek-chat";
  if (!base || !key) {
    return NextResponse.json({ error: "no key" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: { role?: unknown; content?: unknown }[];
    digest?: unknown;
  } | null;
  const messages = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10) as { role: "user" | "assistant"; content: string }[];
  if (!messages.length) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }
  const digest = typeof body?.digest === "string" ? body.digest.slice(0, 800) : "";

  const system =
    `你在为一位博客看板娘维护关于访客的长期记忆小本本。把下面的对话浓缩/合并成记忆要点。\n` +
    `只保留值得长期记住的：称呼与昵称偏好、职业与技术方向、兴趣、近况与烦恼、提过的重要日子。\n` +
    (digest ? `已有记忆（仍然有效的条目必须原样保留，只删除确实过时或被推翻的）：\n${digest}\n` : "") +
    `严格输出不超过 10 行，每行以 "- " 开头、不超过 40 个字，不要输出任何其他文字。`;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...messages],
        max_tokens: 300,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return NextResponse.json({ error: "upstream error" }, { status: 502 });
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const memory = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!memory) return NextResponse.json({ error: "empty reply" }, { status: 502 });
    return NextResponse.json({ memory });
  } catch {
    return NextResponse.json({ error: "request failed" }, { status: 502 });
  }
}
