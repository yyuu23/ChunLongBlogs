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

/** 配置合并（老配置 JSON 缺字段时全部走缺省值，admin 可逐项覆盖） */
export function creditsCfg(aiChat: AiChatConfig): CreditsConfig {
  const c = (aiChat.credits ?? {}) as Partial<CreditsConfig>;
  return {
    enabled: c.enabled ?? CREDITS_DEFAULTS.enabled,
    dailyGrant: clamp0(c.dailyGrant, CREDITS_DEFAULTS.dailyGrant),
    checkinBonus: clamp0(c.checkinBonus, CREDITS_DEFAULTS.checkinBonus),
    levelBonusPerLevel: clamp0(c.levelBonusPerLevel, CREDITS_DEFAULTS.levelBonusPerLevel),
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

/** 一条消息的积分价 = 基准价 × 档位倍率（level 必须传钳制后的真实档位） */
export function messageCost(aiChat: AiChatConfig, choice: AiChatChoice, level: ThinkingLevel): number {
  return Math.max(0, Math.round(choiceCostOf(aiChat, choice) * effortCostOf(aiChat, level)));
}
