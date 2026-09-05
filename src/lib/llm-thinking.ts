import type { AiProvider } from "@/lib/site";

/**
 * 思考强度档位体系（纯函数模块，客户端/服务端共用，不读 env）。
 *
 * 统一档位语义（按各模型真实能力取子集，详见 thinkingSpec）：
 * off=不思考 low=低 mid=中 high=高 max=最高 on=思考（仅二元模型的开关档）
 *
 * 依据三家官方文档（2026-09 核实）：
 * - qwen3.8*：reasoning_effort 取 low/medium/xhigh（没有 high），effort 与 thinking_budget 互斥；
 *   关思考用 enable_thinking:false。其余 qwen 混合模型只有 enable_thinking 布尔。
 * - deepseek-v4*：thinking:{type:"enabled"|"disabled", reasoning_effort:"low"|"high"|"max"}。
 *   旧 deepseek-chat/reasoner 双模型制：开思考=切 reasoner 模型。
 * - glm-5.3*：强制思考（thinking.type 传 disabled 会 400），reasoning_effort 只认 low/high/max；
 *   glm-5.x 其它：枚举含 low/high/max，none 可关思考；glm-4.x：只有 thinking.type 开关。
 */

export const THINKING_LEVEL_KEYS = ["off", "low", "mid", "high", "max", "on"] as const;
export type ThinkingLevel = (typeof THINKING_LEVEL_KEYS)[number];

export interface EffortParams {
  /** 合并进 OpenAI 兼容请求体的供应商特有参数 */
  extraBody?: Record<string, unknown>;
  /** 旧版 deepseek 双模型制：true = 切换到 reasoner 模型（由 llm.ts 结合 env 决定具体模型名） */
  legacyReasoner?: boolean;
}

export interface ThinkingSpec {
  /** 该模型支持的档位（从弱到强；第一个为兜底默认档） */
  levels: ThinkingLevel[];
  /** 档位 → 请求参数 */
  apply: (level: ThinkingLevel) => EffortParams;
  /** 归一化：非法/不支持的档位回退到第一个可用档 */
  resolve: (requested?: unknown) => ThinkingLevel;
}

const isLevel = (v: unknown): v is ThinkingLevel =>
  typeof v === "string" && (THINKING_LEVEL_KEYS as readonly string[]).includes(v);

const baseSpec = (levels: ThinkingLevel[], apply: ThinkingSpec["apply"]): ThinkingSpec => ({
  levels,
  apply,
  resolve: (requested) => (isLevel(requested) && levels.includes(requested) ? requested : levels[0]!),
});

/** 按供应商 + 模型名前缀推断该模型的思考档位规格 */
export function thinkingSpec(provider: AiProvider, model: string): ThinkingSpec {
  const m = (model ?? "").toLowerCase();

  if (provider === "qwen") {
    if (m.startsWith("qwen3.8")) {
      // qwen3.8 系：effort 档位制（low≈4096 / medium≈16384 / xhigh≈262144 tokens）
      return baseSpec(["off", "low", "mid", "max"], (lv) =>
        lv === "off"
          ? { extraBody: { enable_thinking: false } }
          : {
              extraBody: {
                enable_thinking: true,
                reasoning_effort: lv === "low" ? "low" : lv === "mid" ? "medium" : "xhigh",
              },
            },
      );
    }
    // 其它 qwen 混合模型（qwen3-max / qwen-flash 等）：只有布尔开关
    return baseSpec(["off", "on"], (lv) => ({ extraBody: { enable_thinking: lv === "on" } }));
  }

  if (provider === "deepseek") {
    if (m === "deepseek-chat" || m === "deepseek-reasoner" || m.includes("v3")) {
      // 旧双模型制：开思考 = 切 reasoner
      return baseSpec(["off", "on"], (lv) => (lv === "on" ? { legacyReasoner: true } : {}));
    }
    // deepseek-v4*：单模型 + 请求级 thinking 对象
    return baseSpec(["off", "low", "high", "max"], (lv) =>
      lv === "off"
        ? { extraBody: { thinking: { type: "disabled" } } }
        : {
            extraBody: {
              thinking: { type: "enabled", reasoning_effort: lv === "low" ? "low" : lv === "high" ? "high" : "max" },
            },
          },
    );
  }

  // glm
  if (m.startsWith("glm-5.3")) {
    // 强制思考，不可关；effort 只认 low/high/max
    return baseSpec(["low", "high", "max"], (lv) => ({
      extraBody: { thinking: { type: "enabled" }, reasoning_effort: lv === "low" ? "low" : lv === "high" ? "high" : "max" },
    }));
  }
  if (m.startsWith("glm-5")) {
    // glm-5.0/5.1/5.2：可关思考，effort 枚举含 low/high/max（内部宽容映射）
    return baseSpec(["off", "low", "high", "max"], (lv) =>
      lv === "off"
        ? { extraBody: { thinking: { type: "disabled" } } }
        : {
            extraBody: {
              thinking: { type: "enabled" },
              reasoning_effort: lv === "low" ? "low" : lv === "high" ? "high" : "max",
            },
          },
    );
  }
  // glm-4.x：仅思考开关
  return baseSpec(["off", "on"], (lv) => ({ extraBody: { thinking: { type: lv === "on" ? "enabled" : "disabled" } } }));
}

/** 该档位是否处于思考态（决定超时与前端"深度思考"标识） */
export const levelThinks = (lv: ThinkingLevel): boolean => lv !== "off";
