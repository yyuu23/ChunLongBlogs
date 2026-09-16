import { describe, expect, it } from "vitest";
import { buildChatMarkdown, wrapCanvasText } from "@/lib/chatExport";

/** 对话导出纯函数：Markdown 结构 + canvas 断行（fake measureText） */
function fakeCtx(charWidth: number) {
  return { measureText: (s: string) => ({ width: Array.from(s).length * charWidth }) };
}

describe("buildChatMarkdown", () => {
  it("标题/日期头 + 逐条消息；空消息跳过", () => {
    const md = buildChatMarkdown(
      "测试会话",
      [
        { role: "user", content: "你好" },
        { role: "assistant", content: "" }, // 空——跳过
        { role: "assistant", content: "你好呀～" },
      ],
      "ChunLong Blog",
    );
    expect(md).toContain("# ChunLong Blog · 测试会话");
    expect(md).toContain("**🧑 我：**");
    expect(md).toContain("你好");
    expect(md).toContain("**🐱 助手：**");
    expect(md).toContain("你好呀～");
    // 只有一对有效消息（空消息不产生段落）
    expect(md.match(/\*\*🐱 助手：\*\*/g)).toHaveLength(1);
  });
});

describe("wrapCanvasText", () => {
  it("CJK 逐字符断行，行数上限生效", () => {
    const ctx = fakeCtx(10); // 每字符 10px
    const exact = wrapCanvasText(ctx, "一二三四五六七八九十", 50, 2); // 正好两行，不截断
    expect(exact).toEqual(["一二三四五", "六七八九十"]);
    const over = wrapCanvasText(ctx, "一二三四五六七八九十一", 50, 2); // 11 字 → 末行截断
    expect(over).toHaveLength(2);
    expect(over[1]).toBe("六七八九…");
  });

  it("短文本不截断", () => {
    const ctx = fakeCtx(10);
    expect(wrapCanvasText(ctx, "abc", 100, 3)).toEqual(["abc"]);
  });

  it("emoji 代理对不被切断", () => {
    const ctx = fakeCtx(10);
    const lines = wrapCanvasText(ctx, "🎉🎉🎉🎉", 20, 10); // 20px=2 emoji/行
    expect(lines).toEqual(["🎉🎉", "🎉🎉"]);
  });
});
