import type { AiProvider, SiteConfig } from "@/lib/site/types";
import type { ThinkingLevel } from "@/lib/ai/thinking";
import { providerAvailable, resolveAiChatChoice, resolveProviderModel } from "@/lib/ai/provider";
import { thinkingSpec } from "@/lib/ai/thinking";
import { CHOICE_COST_DEFAULTS, creditsCfg, effortCostOf, peakMultiplierOf } from "@/lib/engagement/credits";

export interface PickerChoice {
  id: string;
  label: string;
  provider: AiProvider;
  /** 服务端解析后的真实模型名（展示用） */
  model: string;
  /** 该模型支持的思考档位（弱→强） */
  levels: ThinkingLevel[];
  /** 每条消息基准积分（✦） */
  cost: number;
  /** 各档位实际积分价（档位 id → 分） */
  levelCosts: Record<string, number>;
  /** 限时促销展示（划线原价；until 过期自动隐藏） */
  promo?: { originalCost?: number; label?: string; until?: string };
}

export interface AiChoicesPublic {
  allow: boolean;
  defaultChoice: string;
  defaultEffort: string;
  choices: PickerChoice[];
  /** 积分体系：enabled=false 时选择器不显示价格元素 */
  credits: { enabled: boolean; dailyGrant: number; peakMultiplier?: number };
}

/** 模型选择器的公开数据（/chat 页与文章伴读面板共用下发）：
 *  过滤未配 Key 的供应商，带真实模型名、思考档位与积分价。
 *  品牌/模型名/积分价是公开信息；API key 与接入地址仍只在服务端。 */
export function buildAiChoicesPublic(aiChat: SiteConfig["aiChat"]): AiChoicesPublic {
  const resolved = resolveAiChatChoice(aiChat);
  const creditCfg = creditsCfg(aiChat);
  return {
    allow: aiChat.allowVisitorChoice,
    defaultChoice: resolved?.id ?? "",
    defaultEffort: aiChat.defaultEffort,
    choices: aiChat.choices
      .filter((choice) => providerAvailable(choice.provider))
      .map((choice) => {
        const model = resolveProviderModel(choice.provider, choice.model);
        const base = choice.cost ?? CHOICE_COST_DEFAULTS[choice.provider] ?? 10;
        const levels = thinkingSpec(choice.provider, model).levels;
        return {
          id: choice.id,
          label: choice.label,
          provider: choice.provider,
          model,
          levels,
          cost: base,
          promo: choice.promo,
          // 该模型各档位的实际积分价（与扣费同口径：向下取整，钳制到其支持的档位）
          levelCosts: Object.fromEntries(
            levels.map((level) => [level, Math.max(0, Math.floor(base * effortCostOf(aiChat, level)))]),
          ) as Record<string, number>,
        };
      }),
    credits: {
      enabled: creditCfg.enabled,
      dailyGrant: creditCfg.dailyGrant,
      peakMultiplier: peakMultiplierOf(aiChat),
    },
  };
}
