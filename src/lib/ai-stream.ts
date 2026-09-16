/**
 * 后台 AI 流式输出（写作助手等段落级交互用）：
 * OpenAI 兼容 /chat/completions 的 stream:true 单轮调用，把上游 SSE 解析成
 * 纯正文增量的 ReadableStream<string>。解析逻辑照搬前台聊天（/api/chat 的
 * relayUpstream）：buffer 跨块拼接、`data:` 行、`[DONE]`、`: keep-alive` 注释行
 * 跳过、单帧解析失败不中断整流——只取 delta.content，不管思考流与工具调用
 * （编辑场景关思考、无工具）。上游不支持流式时用 bufferedChatLLM 降级。
 * 配置复用 lib/ai.ts 的 llmConfig（跟随后台默认预设，level off）。
 */
import { LLM_NOT_CONFIGURED_MSG } from "@/lib/llm";
import { chatLLM, llmConfig } from "@/lib/ai";

export interface StreamChatOpts {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** 与客户端断开联动（abort 时上游请求一并取消） */
  signal?: AbortSignal;
}

export type StreamChatResult =
  | { ok: true; stream: ReadableStream<string> }
  | { ok: false; status: number; error: string };

/** 发起流式请求：成功返回正文增量流（流由调用方消费，结束自动 close） */
export async function streamChatLLM(opts: StreamChatOpts): Promise<StreamChatResult> {
  const llm = await llmConfig();
  if (!llm) return { ok: false, status: 503, error: LLM_NOT_CONFIGURED_MSG };
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 90_000);
  try {
    const res = await fetch(`${llm.base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.key}`,
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.5,
        stream: true,
        ...llm.extraBody,
      }),
      signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: 502, error: `AI 接口返回 ${res.status}：${text.slice(0, 140)}` };
    }

    const upstream = res.body;
    const stream = new ReadableStream<string>({
      async start(controller) {
        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? ""; // 最后一段可能不完整，留到下一块
            for (const line of lines) {
              const trimmed = line.trim();
              // SSE 注释行（keep-alive）与空行跳过
              if (!trimmed || trimmed.startsWith(":")) continue;
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const piece = parsed.choices?.[0]?.delta?.content;
                if (typeof piece === "string" && piece) controller.enqueue(piece);
              } catch {
                // 单帧解析失败不中断整流
              }
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
      cancel() {
        // 调用方 abort 时联动取消上游（getReader 的 cancel 会传播）
        void upstream.cancel().catch(() => {});
      },
    });
    return { ok: true, stream };
  } catch (e) {
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      return { ok: false, status: 504, error: "AI 响应超时，请重试" };
    }
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? `请求失败：${e.message}` : "请求失败",
    };
  }
}

/** 非流式降级：上游不支持 stream 时一次性返回完整正文（复用 ai.ts 的样板） */
export async function bufferedChatLLM(
  opts: StreamChatOpts,
): Promise<{ ok: true; content: string } | { ok: false; status: number; error: string }> {
  return chatLLM(opts.system, opts.user, {
    maxTokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.5,
    timeoutMs: opts.timeoutMs,
  });
}
