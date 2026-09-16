import "server-only";

import type { ToolCall } from "@/lib/chat/sse";

export interface LoopMessage {
  role: "system" | "user" | "assistant" | "tool";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolTrace {
  name: string;
  label: string;
  detail: string;
  result?: string;
}

interface ToolLoopOptions {
  initialMessages: LoopMessage[];
  maxRounds?: number;
  invoke: (
    messages: LoopMessage[],
    allowTools: boolean,
    round: number,
  ) => Promise<{ content: string; toolCalls: ToolCall[] }>;
  execute: (call: ToolCall) => Promise<{ content: string; trace: ToolTrace }>;
  onToolStart?: (call: ToolCall) => void;
  onToolsChanged?: (tools: ToolTrace[]) => void;
}

/** Shared function-calling loop for JSON and SSE chat transports. */
export async function runToolLoop({
  initialMessages,
  maxRounds = 3,
  invoke,
  execute,
  onToolStart,
  onToolsChanged,
}: ToolLoopOptions) {
  const messages = [...initialMessages];
  const tools: ToolTrace[] = [];
  let content = "";

  for (let round = 0; round <= maxRounds; round += 1) {
    const allowTools = round < maxRounds;
    const result = await invoke(messages, allowTools, round);
    content = result.content;
    if (!result.toolCalls.length || !allowTools) break;

    messages.push({ role: "assistant", content, tool_calls: result.toolCalls });
    for (const call of result.toolCalls) {
      onToolStart?.(call);
      const executed = await execute(call);
      tools.push(executed.trace);
      messages.push({ role: "tool", tool_call_id: call.id, content: executed.content });
    }
    onToolsChanged?.([...tools]);
  }

  return { content, tools };
}
