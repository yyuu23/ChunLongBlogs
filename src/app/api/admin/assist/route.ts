import { requireAdminApi } from "@/lib/auth/admin-session";
import { clientIp, rateLimit } from "@/lib/shared/rate-limit";
import { incrStat } from "@/lib/analytics/stats";
import { ASSIST_ACTION_LABEL, buildAssistMessages, validateAssistParams } from "@/lib/ai/assist";
import { bufferedChatLLM, streamChatLLM } from "@/lib/ai/stream";

export const dynamic = "force-dynamic";

/** SSE 帧格式：`event: <name>\ndata: <json>\n\n`（照 /api/chat） */
function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 写作助手（后台专用，SSE 流式）：对编辑器选区做改写/扩写/缩写/翻译/解释/
 * 自定义指令，或从光标处续写。事件协议：delta {"text"} ×N → done {"content"}
 * / error {"message"}。上游不支持流式时自动降级一次性返回（单帧 delta + done）。
 * 客户端断开（request.signal abort）会联动取消上游请求。
 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }
  const rl = rateLimit(`assist:${clientIp(request)}`, 10, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: `太快了，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  const body = await request.json().catch(() => null);
  const v = validateAssistParams(body);
  if (!v.ok) {
    return Response.json({ error: v.error }, { status: 400 });
  }
  const { system, user } = buildAssistMessages(v.params);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (frame: string) => controller.enqueue(encoder.encode(frame));
      let content = "";
      try {
        const r = await streamChatLLM({
          system,
          user,
          maxTokens: 2048,
          temperature: 0.5,
          timeoutMs: 90_000,
          signal: request.signal,
        });
        if (r.ok) {
          const reader = r.stream.getReader();
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              content += value;
              send(sse("delta", { text: value }));
            }
          } finally {
            reader.releaseLock();
          }
          if (content) {
            void incrStat("ai_tool", `写作助手·${ASSIST_ACTION_LABEL[v.params.action]}`);
            send(sse("done", { content }));
          } else {
            // 上游空流（个别网关在流式路径返回空）——降级非流式补一发
            const buf = await bufferedChatLLM({ system, user, maxTokens: 2048, temperature: 0.5 });
            if (buf.ok) {
              void incrStat("ai_tool", `写作助手·${ASSIST_ACTION_LABEL[v.params.action]}`);
              send(sse("delta", { text: buf.content }));
              send(sse("done", { content: buf.content }));
            } else {
              send(sse("error", { message: buf.error }));
            }
          }
        } else {
          // 流式失败 → 非流式降级
          const buf = await bufferedChatLLM({ system, user, maxTokens: 2048, temperature: 0.5 });
          if (buf.ok) {
            void incrStat("ai_tool", `写作助手·${ASSIST_ACTION_LABEL[v.params.action]}`);
            send(sse("delta", { text: buf.content }));
            send(sse("done", { content: buf.content }));
          } else {
            send(sse("error", { message: r.error }));
          }
        }
      } catch {
        // 客户端断开（request.signal abort 传播）——静默收尾
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // nginx 反代下禁用缓冲，流式帧才能实时透出（/api/chat 同款）
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
