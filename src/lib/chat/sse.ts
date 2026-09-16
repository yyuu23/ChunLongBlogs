import "server-only";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface StreamDelta {
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: ToolCallDelta[];
}

export function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function relayUpstreamSse(
  upstream: ReadableStream<Uint8Array>,
  send: (frame: string) => void,
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let announcedThinking = false;
  const toolCalls: ToolCall[] = [];

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: StreamDelta }> };
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;
          if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
            if (!announcedThinking) {
              announcedThinking = true;
              send(encodeSse("status", { stage: "thinking" }));
            }
            send(encodeSse("reasoning", { text: delta.reasoning_content }));
          }
          if (typeof delta.content === "string" && delta.content) {
            content += delta.content;
            send(encodeSse("delta", { text: delta.content }));
          }
          for (const fragment of delta.tool_calls ?? []) {
            const index = fragment.index ?? toolCalls.length;
            const slot = (toolCalls[index] ??= {
              id: "",
              type: "function",
              function: { name: "", arguments: "" },
            });
            if (fragment.id) slot.id = fragment.id;
            if (fragment.function?.name) slot.function.name = fragment.function.name;
            if (fragment.function?.arguments) slot.function.arguments += fragment.function.arguments;
          }
        } catch {
          // A malformed upstream frame should not abort the rest of the stream.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    content,
    toolCalls: toolCalls.filter((call) => call.function.name || call.function.arguments),
  };
}
