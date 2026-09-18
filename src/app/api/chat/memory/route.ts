import { NextResponse } from "next/server";
import { clientIp } from "@/lib/shared/rate-limit";
import { getLlmRequest, resolveAiChatChoice } from "@/lib/ai/provider";
import { getSiteConfig } from "@/lib/site/repository";
import { assertSameOrigin, publicWriteErrorResponse, quotaResponse } from "@/lib/public-write/guard";
import { attachAnonymousVisitorCookie, resolveAnonymousVisitor } from "@/lib/public-write/identity";
import { readJson } from "@/lib/public-write/json";
import { burstQuota, persistentQuota } from "@/lib/public-write/quota";
import { chatMemorySchema } from "@/lib/public-write/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/memory —— 把最近的对话浓缩成长期记忆要点，返回给客户端存它自己的 localStorage。
 * 计入聊天的全局日额度（dailyCount("chat:global")，成本上限统一）；记忆只在响应里走一趟，服务端不落库。
 */
export async function POST(request: Request) {
  let body;
  try {
    assertSameOrigin(request);
    body = await readJson(request, chatMemorySchema, 128 * 1024);
  } catch (error) {
    return publicWriteErrorResponse(error) ?? NextResponse.json({ error: "internal" }, { status: 500 });
  }
  const visitor = await resolveAnonymousVisitor(request);
  // 提取频率本就低（每 4 轮一次），分钟限流从紧
  const rl = burstQuota("chat-memory", "ip", clientIp(request), 5, 60_000);
  if (!rl.ok) {
    return attachAnonymousVisitorCookie(
      quotaResponse(rl.retryAfter),
      request,
      visitor,
    );
  }

  // 与聊天共享每日总额度（记忆提取也是 LLM 成本）
  const dailyLimit = Number(process.env.CHAT_DAILY_LIMIT) || 500;
  const dl = persistentQuota("chat-global", "global", "global", dailyLimit, 24 * 60 * 60_000);
  if (!dl.ok) {
    return attachAnonymousVisitorCookie(
      quotaResponse(dl.retryAfter, "daily limit"),
      request,
      visitor,
    );
  }

  // 记忆蒸馏要快：跟随后台默认模型预设，但固定关思考
  const config = await getSiteConfig();
  const choice = resolveAiChatChoice(config.aiChat);
  const llm = choice
    ? getLlmRequest({ provider: choice.provider, model: choice.model, level: "off" })
    : null;
  if (!llm) {
    return attachAnonymousVisitorCookie(NextResponse.json({ error: "no key" }, { status: 503 }), request, visitor);
  }
  const messages = body.messages.slice(-10);
  const digest = body.digest ?? "";

  const system =
    `你在为一位博客看板娘维护关于访客的长期记忆小本本。把下面的对话浓缩/合并成记忆要点。\n` +
    `只保留值得长期记住的：称呼与昵称偏好、职业与技术方向、兴趣、近况与烦恼、提过的重要日子。\n` +
    (digest ? `已有记忆（仍然有效的条目必须原样保留，只删除确实过时或被推翻的）：\n${digest}\n` : "") +
    `严格输出不超过 10 行，每行以 "- " 开头、不超过 40 个字，不要输出任何其他文字。`;

  try {
    const res = await fetch(`${llm.base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${llm.key}` },
      body: JSON.stringify({
        model: llm.model,
        messages: [{ role: "system", content: system }, ...messages],
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
    const memory = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!memory) {
      return attachAnonymousVisitorCookie(
        NextResponse.json({ error: "empty reply" }, { status: 502 }),
        request,
        visitor,
      );
    }
    return attachAnonymousVisitorCookie(NextResponse.json({ memory }), request, visitor);
  } catch {
    return attachAnonymousVisitorCookie(
      NextResponse.json({ error: "request failed" }, { status: 502 }),
      request,
      visitor,
    );
  }
}
