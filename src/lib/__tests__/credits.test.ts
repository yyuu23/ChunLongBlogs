import { describe, expect, it } from "vitest";
import { creditsCfg, effortCostOf, choiceCostOf, messageCost, peakMultiplierOf } from "@/lib/credits";
import type { AiChatConfig, AiChatChoice } from "@/lib/site";

/** 最小可用配置对象——credits.ts 只读 choices/effortCost/credits 三个字段 */
const cfg = (over: Record<string, unknown> = {}) => ({ choices: [], ...over }) as unknown as AiChatConfig;
const glm = { id: "glm", label: "GLM", provider: "glm", model: "glm-4.7" } as unknown as AiChatChoice;
const deepseek = { id: "ds", label: "DS", provider: "deepseek", model: "deepseek-v3" } as unknown as AiChatChoice;

describe("creditsCfg：缺省合并与非法值回退", () => {
  it("空配置全部走缺省", () => {
    const c = creditsCfg(cfg());
    expect(c.enabled).toBe(true);
    expect(c.dailyGrant).toBe(500);
    expect(c.checkinBonus).toBe(100);
    expect(c.levelBonusPerLevel).toBe(5);
  });

  it("admin 覆盖逐项生效", () => {
    const c = creditsCfg(cfg({ credits: { dailyGrant: 800, levelBonusPerLevel: 0, enabled: false } }));
    expect(c.enabled).toBe(false);
    expect(c.dailyGrant).toBe(800);
    expect(c.levelBonusPerLevel).toBe(0);
  });

  it("负数/非法值回退缺省而非 0", () => {
    const c = creditsCfg(cfg({ credits: { dailyGrant: -5, checkinBonus: "abc" } }));
    expect(c.dailyGrant).toBe(500);
    expect(c.checkinBonus).toBe(100);
  });
});

describe("定价纯函数", () => {
  it("档位倍率缺省：off/low=1，mid=2，high=4，max/on=6", () => {
    expect(effortCostOf(cfg(), "off")).toBe(1);
    expect(effortCostOf(cfg(), "low")).toBe(1);
    expect(effortCostOf(cfg(), "mid")).toBe(2);
    expect(effortCostOf(cfg(), "high")).toBe(4);
    expect(effortCostOf(cfg(), "max")).toBe(6);
  });

  it("供应商基准价：glm 12 / deepseek 15 / qwen 10；预设 cost 覆盖", () => {
    expect(choiceCostOf(cfg(), glm)).toBe(12);
    expect(choiceCostOf(cfg(), deepseek)).toBe(15);
    const withPreset = cfg({ choices: [{ id: "glm", label: "GLM", provider: "glm", model: "m", cost: 20 }] });
    expect(choiceCostOf(withPreset, glm)).toBe(20);
  });

  it("messageCost = 基准 × 档位，向下取整", () => {
    expect(messageCost(cfg(), glm, "mid")).toBe(24); // 12×2
    expect(messageCost(cfg(), deepseek, "high")).toBe(60); // 15×4
  });

  it("高峰倍率只作用于 deepseek；未配置时缺省 ×2；<2 视为关闭", () => {
    expect(peakMultiplierOf(cfg())).toBe(2);
    expect(peakMultiplierOf(cfg({ credits: { peakMultiplier: 1.5 } }))).toBe(2);
    expect(peakMultiplierOf(cfg({ credits: { peakMultiplier: 3 } }))).toBe(3);

    expect(messageCost(cfg(), deepseek, "mid", true)).toBe(60); // 30×2
    expect(messageCost(cfg({ credits: { peakMultiplier: 3 } }), deepseek, "mid", true)).toBe(90); // 30×3
    expect(messageCost(cfg(), glm, "mid", true)).toBe(24); // 非 deepseek 不受高峰影响
  });
});
