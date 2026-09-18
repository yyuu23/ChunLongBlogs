import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("chat tool loop", () => {
  it("shares message/tool orchestration across streaming and JSON transports", async () => {
    const { runToolLoop } = await import("@/lib/chat/tool-loop");
    const seenMessages: number[] = [];
    const changed = vi.fn();
    const result = await runToolLoop({
      initialMessages: [{ role: "system", content: "system" }],
      invoke: async (messages, _allowTools, round) => {
        seenMessages.push(messages.length);
        return round === 0
          ? {
              content: "",
              toolCalls: [
                {
                  id: "call-1",
                  type: "function" as const,
                  function: { name: "site_stats", arguments: "{}" },
                },
              ],
            }
          : { content: "answer", toolCalls: [] };
      },
      execute: async (call) => ({
        content: '{"posts":3}',
        trace: { name: call.function.name, label: "统计", detail: "", result: "3 posts" },
      }),
      onToolsChanged: changed,
    });

    expect(seenMessages).toEqual([1, 3]);
    expect(result.content).toBe("answer");
    expect(result.tools).toHaveLength(1);
    expect(changed).toHaveBeenCalledOnce();
  });
});
