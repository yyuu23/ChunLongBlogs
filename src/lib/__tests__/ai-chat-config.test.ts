import { describe, expect, it } from "vitest";
import { sanitizeAiChatConfig } from "@/lib/admin/ai-chat-config";
import type { AiChatConfig } from "@/lib/site";
import { budgetYuanToCredits, suggestModelCredits } from "@/lib/admin/ai-pricing";

const base: AiChatConfig = {
  choices: [{ id: "main", label: "Main", provider: "deepseek" }],
  defaultChoice: "main",
  defaultEffort: "off",
  allowVisitorChoice: true,
  perVisitorHourly: 20,
  perVisitorDaily: 100,
};

describe("AI chat config sanitation", () => {
  it("deduplicates presets and strips untrusted tools", () => {
    const result = sanitizeAiChatConfig({
      ...base,
      choices: [
        ...base.choices,
        { id: "main", label: "Duplicate", provider: "qwen" },
      ],
      tools: { list_posts: true, unknown: true },
      customTools: [
        { id: "1", name: "weather!", description: " weather ", endpoint: "https://tools.test/weather" },
        { id: "2", name: "bad", description: "bad", endpoint: "file:///tmp/bad" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.choices).toHaveLength(1);
    expect(result.config.tools).toEqual({ list_posts: true });
    expect(result.config.customTools).toEqual([
      { id: "1", name: "weather", description: "weather", endpoint: "https://tools.test/weather" },
    ]);
  });

  it("rejects an empty model list", () => {
    expect(sanitizeAiChatConfig({ ...base, choices: [] })).toEqual({
      ok: false,
      error: "至少保留一个有效的模型预设",
    });
  });
});

describe("AI pricing helpers", () => {
  it("rounds a daily budget into stable credit steps", () => {
    expect(budgetYuanToCredits("0.83")).toBe(850);
    expect(budgetYuanToCredits("2.04")).toBe(2000);
    expect(budgetYuanToCredits(0)).toBeNull();
  });

  it("converts provider prices without depending on form state", () => {
    expect(
      suggestModelCredits(
        {
          id: "priced",
          label: "Priced",
          provider: "deepseek",
          apiPrice: { input: 2, cache: 1, output: 8, outputMult: 2 },
        },
        { markup: 2, inputTokens: 4000, outputTokens: 1000 },
      ),
    ).toBe(44);
  });
});
