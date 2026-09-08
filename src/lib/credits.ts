import type { AiChatChoice, AiChatConfig } from "@/lib/site";
import type { ThinkingLevel } from "@/lib/llm-thinking";

/**
 * AI 积分（✦）纯函数层（客户端安全，禁止引入 db）：
 * 定价缺省值与「模型基准价 × 档位倍率」计算。
 * 余额的原子扣减/退款在 credits-server.ts（服务端专用）。
 */

/** 档位倍率缺省：思考越深、单次上游 token 越多（思维链计入输出计费） */
export const EFFORT_COST_DEFAULTS: Record<ThinkingLevel, number> = {
  off: 1,
  low: 1,
  mid: 2,
  high: 4,
  max: 6,
  on: 6,
};

/** 供应商基准价缺省（元/条 ≈ 积分价 × 0.001，对齐 2026-09 官方牌价 ×4） */
export const CHOICE_COST_DEFAULTS: Record<AiChatChoice["provider"], number> = {
  glm: 12,
  deepseek: 15,
  qwen: 10,
};

export interface CreditsConfig {
  /** false = 积分体系整体关闭，回退到旧的每日次数限制 */
  enabled: boolean;
  /** 每日首访发放 */
  dailyGrant: number;
  /** 每日签到加成 */
  checkinBonus: number;
  /** 每等级加成/日（Lv 越高领越多） */
  levelBonusPerLevel: number;
  /** DeepSeek 高峰时段积分倍率（北京时间工作日 9-12/14-18 点），<2 视为关闭 */
  peakMultiplier?: number;
  /** 定价加价倍数（admin 的 API 价格换算工具用：成本 × 此倍数 = 售价） */
  pricingMarkup?: number;
  /** 换算预估：单条消息输入 tokens */
  estInputTokens?: number;
  /** 换算预估：单条消息输出 tokens（思考膨胀由各模型 apiPrice.outputMult 表达） */
  estOutputTokens?: number;
}

const CREDITS_DEFAULTS: CreditsConfig = {
  enabled: true,
  dailyGrant: 500,
  checkinBonus: 100,
  levelBonusPerLevel: 5,
};

const clamp0 = (n: unknown, fallback: number) => {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

/** 配置合并（老配置 JSON 缺字段时全部走缺省值，admin 可逐项覆盖；
 *  可选字段原样透传——admin 里 {...cr, x} 展开时不能丢掉它们） */
export function creditsCfg(aiChat: AiChatConfig): CreditsConfig {
  const c = (aiChat.credits ?? {}) as Partial<CreditsConfig>;
  return {
    enabled: c.enabled ?? CREDITS_DEFAULTS.enabled,
    dailyGrant: clamp0(c.dailyGrant, CREDITS_DEFAULTS.dailyGrant),
    checkinBonus: clamp0(c.checkinBonus, CREDITS_DEFAULTS.checkinBonus),
    levelBonusPerLevel: clamp0(c.levelBonusPerLevel, CREDITS_DEFAULTS.levelBonusPerLevel),
    peakMultiplier: c.peakMultiplier,
    pricingMarkup: c.pricingMarkup,
    estInputTokens: c.estInputTokens,
    estOutputTokens: c.estOutputTokens,
  };
}

/** 档位倍率（admin effortCost 覆盖缺省） */
export function effortCostOf(aiChat: AiChatConfig, level: ThinkingLevel): number {
  const v = aiChat.effortCost?.[level];
  return clamp0(v, EFFORT_COST_DEFAULTS[level] ?? 1);
}

/** 模型基准价（预设 cost 覆盖供应商缺省） */
export function choiceCostOf(aiChat: AiChatConfig, choice: AiChatChoice): number {
  const preset = aiChat.choices.find((c) => c.id === choice.id);
  if (preset?.cost !== undefined) return clamp0(preset.cost, 0);
  return CHOICE_COST_DEFAULTS[choice.provider] ?? 10;
}

/** DeepSeek 高峰时段（北京时间周一至周五 9:00–12:00、14:00–18:00，与官方计费口径一致） */
export function isDeepSeekPeakNow(now = new Date()): boolean {
  try {
    const bj = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
    const day = bj.getDay();
    const h = bj.getHours();
    if (day === 0 || day === 6) return false;
    return (h >= 9 && h < 12) || (h >= 14 && h < 18);
  } catch {
    return false;
  }
}

/** DeepSeek 高峰倍率（<2 视为关闭） */
export function peakMultiplierOf(aiChat: AiChatConfig): number {
  const n = Number(aiChat.credits?.peakMultiplier);
  return Number.isFinite(n) && n >= 2 ? n : 2;
}

/** 当前是否应对该模型应用高峰加价（仅 deepseek 供应商生效） */
export function isPeakApplied(choice: AiChatChoice, now = new Date()): boolean {
  return choice.provider === "deepseek" && isDeepSeekPeakNow(now);
}

/** 一条消息的积分价 = 基准价 × 档位倍率（level 必须传钳制后的真实档位）；
 *  结果向下取整为整数（积分不出现小数，如 15×1.5=22.5 → 22）；
 *  DeepSeek 在高峰时段整体乘以高峰倍率（peak=true 时生效） */
export function messageCost(
  aiChat: AiChatConfig,
  choice: AiChatChoice,
  level: ThinkingLevel,
  peak = false,
): number {
  const base = Math.floor(choiceCostOf(aiChat, choice) * effortCostOf(aiChat, level));
  if (peak && choice.provider === "deepseek") {
    const mult = peakMultiplierOf(aiChat);
    if (mult > 1) return Math.floor(base * mult);
  }
  return base;
}
