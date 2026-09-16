import { describe, expect, it } from "vitest";
import { ASSIST_ACTION_LABEL, buildAssistMessages, validateAssistParams } from "@/lib/ai-assist";

/** 写作助手纯逻辑：入参校验边界 + 8 动作 prompt 拼装 */
describe("validateAssistParams", () => {
  const sel = { action: "rewrite", selection: "这是一段足够长的选中文本内容示例。" };

  it("合法选区动作通过并钳制长度", () => {
    const r = validateAssistParams({ ...sel, title: "x".repeat(500) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.params.title!.length).toBeLessThanOrEqual(100);
  });

  it("未知动作 / 非对象拒绝", () => {
    expect(validateAssistParams({ action: "hack" }).ok).toBe(false);
    expect(validateAssistParams(null).ok).toBe(false);
    expect(validateAssistParams("x").ok).toBe(false);
  });

  it("选区过短拒绝；continue 之外必填选区", () => {
    expect(validateAssistParams({ action: "rewrite", selection: "太短" }).ok).toBe(false);
    expect(validateAssistParams({ action: "expand" }).ok).toBe(false);
  });

  it("custom 必填指令；continue 必填上文", () => {
    expect(validateAssistParams({ action: "custom", selection: sel.selection }).ok).toBe(false);
    expect(validateAssistParams({ action: "continue" }).ok).toBe(false);
    expect(validateAssistParams({ action: "continue", context: "前文".repeat(20) }).ok).toBe(true);
  });
});

describe("buildAssistMessages", () => {
  const SEL = "这是一段足够长的选中文本内容示例。";

  it("选区动作：任务行 + 前文 + 选区 + 后文", () => {
    const v = validateAssistParams({
      action: "rewrite",
      selection: SEL,
      contextBefore: "前文",
      contextAfter: "后文",
      title: "标题",
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const { system, user } = buildAssistMessages(v.params);
    expect(system).toContain("只处理【选区】");
    expect(user).toContain(ASSIST_ACTION_LABEL.rewrite);
    expect(user).toContain(`【选区】\n${SEL}`);
    expect(user).toContain("【前文】");
    expect(user).toContain("【后文】");
  });

  it("custom 动作带指令；continue 只有上文", () => {
    const c = validateAssistParams({ action: "custom", selection: SEL, instruction: "加点比喻" });
    expect(c.ok && buildAssistMessages(c.params).user).toContain("加点比喻");
    const cont = validateAssistParams({ action: "continue", context: "很长的一段上文内容。".repeat(5), title: "T" });
    expect(cont.ok).toBe(true);
    if (!cont.ok) return;
    const { user } = buildAssistMessages(cont.params);
    expect(user).toContain("【上文】");
    expect(user).not.toContain("【选区】");
  });

  it("八个动作都有中文标签", () => {
    expect(Object.keys(ASSIST_ACTION_LABEL)).toHaveLength(8);
    for (const label of Object.values(ASSIST_ACTION_LABEL)) expect(label.length).toBeGreaterThan(0);
  });
});
