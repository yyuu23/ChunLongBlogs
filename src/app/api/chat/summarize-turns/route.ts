import { NextResponse } from "next/server";
import { clientIp } from "@/lib/rateLimit";
import { getLlmRequest, resolveAiChatChoice } from "@/lib/llm";
import { getSiteConfig } from "@/lib/site";
import { assertSameOrigin, publicWriteErrorResponse, quotaResponse } from "@/lib/public-write/guard";
import { attachAnonymousVisitorCookie, resolveAnonymousVisitor } from "@/lib/public-write/identity";
import { readJson } from "@/lib/public-write/json";
import { burstQuota, persistentQuota } from "@/lib/public-write/quota";
import { chatSummarizeSchema } from "@/lib/public-write/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/summarize-turns —— 长会话滚动摘要：把 16 条窗口之外的
 * 溢出消息与已有摘要合并成新摘要，返回给客户端存它自己的 localStorage
 * （下一轮请求作为 summary 注入 system；服务端不落库，与记忆提取同口径）。
 * 计入聊天的全局日额度（chat:global），成本上限统一。
 */
export async function POST(request: Request) {
  let body;
  try {
    assertSameOrigin(request);
    body = await readJson(request, chatSummarizeSchema, 256 * 1024);
  } catch (error) {
    return publicWriteErrorResponse(error) ?? NextResponse.json({ error: "internal" }, { status: 500 });
  }
  const visitor = await resolveAnonymousVisitor(request);
  const rl = burstQuota("chat-summarize", "ip", clientIp(request), 5, 60_000);
  if (!rl.ok) {
    return attachAnonymousVisitorCookie(quotaResponse(rl.retryAfter), request, visitor);
  }

  // 与聊天/记忆共享每日总额度（摘要也是 LLM 成本）
  const dailyLimit = Number(process.env.CHAT_DAILY_LIMIT) || 500;
  const dl = persistentQuota("chat-global", "global", "global", dailyLimit, 24 * 60 * 60_000);
  if (!dl.ok) {
    return attachAnonymousVisitorCookie(quotaResponse(dl.retryAfter, "daily limit"), request, visitor);
  }

  const config = await getSiteConfig();
  const choice = resolveAiChatChoice(config.aiChat);
  const llm = choice ? getLlmRequest({ provider: choice.provider, model: choice.model, level: "off" }) : null;
  if (!llm) {
    return attachAnonymousVisitorCookie(NextResponse.json({ error: "no key" }, { status: 503 }), request, visitor);
  }

  const prev = body.prevSummary ?? "";
  const system =
    `你在维护一段博客 AI 聊天的滚动摘要。把「已有摘要」与「新增对话」合并为一份新摘要，供后续对话作背景。\n` +
    (prev ? `已有摘要：\n${prev}\n` : "") +
    `要求：中文，不超过 200 字；保留访客的核心诉求与偏好、已给出的关键结论、双方的约定与未决问题；` +
    `丢弃寒暄、重复、与后续无关的细节；只输出摘要本身，无前缀无解释。`;

  try {
    const res = await fetch(`${llm.base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${llm.key}` },
      body: JSON.stringify({
        model: llm.model,
        messages: [{ role: "system", content: system }, ...body.messages],
        max_tokens: 300,
        temperature: 0.2,
        ...llm.extraBody,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return attachAnonymousVisitorCookie(
        NextResponse.json({ error: "upstream error" }, { status: 502 }),
        request,
        visitor,
      );
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const summary = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!summary) {
      return attachAnonymousVisitorCookie(NextResponse.json({ error: "empty reply" }, { status: 502 }), request, visitor);
    }
    return attachAnonymousVisitorCookie(NextResponse.json({ summary }), request, visitor);
  } catch {
    return attachAnonymousVisitorCookie(NextResponse.json({ error: "request failed" }, { status: 502 }), request, visitor);
  }
}
