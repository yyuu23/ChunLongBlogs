import type { AiChatConfig, AiChatChoice, AiProvider } from "@/lib/site";
import { thinkingSpec, type ThinkingLevel } from "@/lib/llm-thinking";

/**
 * 全站 LLM 供应商统一解析（/api/chat、/api/chat/memory、后台 AI 编辑共用）。
 * 供应商 key 全部放 .env（DEEPSEEK_API_KEY / GLM_API_KEY / QWEN_API_KEY），
 * 哪家暴露给访客、默认用哪家由 /admin/ai-chat 的预设（siteConfigs.aiChat）决定。
 *
 * 思考强度档位（off/low/mid/high/max/on）由 llm-thinking.ts 按供应商与模型代际
 * 自动适配生效方式（reasoning_effort / thinking 对象 / enable_thinking / 旧版模型切换）。
 */

export interface LlmRequest {
  base: string;
  key: string;
  model: string;
  /** 追加到请求体的供应商特有参数（思考档位参数等） */
  extraBody?: Record<string, unknown>;
  /** 生效的思考档位（调用方可据此调整超时与前端展示） */
  level: ThinkingLevel;
}

/** 供应商别名归一（env 与预设里都可能出现写法差异） */
const PROVIDER_ALIASES: Record<string, AiProvider> = {
  deepseek: "deepseek",
  glm: "glm",
  zhipu: "glm",
  bigmodel: "glm",
  qwen: "qwen",
  dashscope: "qwen",
  aliyun: "qwen",
};

/** 各供应商的内置默认值（均可用 *_API_BASE / *_MODEL 环境变量覆盖） */
const PROVIDER_DEFAULTS: Record<AiProvider, { base: string; model: string; thinkingModel?: string }> = {
  deepseek: {
    base: "https://api.deepseek.com/v1",
    // V4 起统一为单模型 + 请求级 thinking 开关（chat/reasoner 双模型制已下线）
    model: "deepseek-v4-flash",
    thinkingModel: "deepseek-reasoner",
  },
  glm: { base: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.3-flash" },
  qwen: {
    // 站长的阿里云 MaaS 专属实例（OpenAI 兼容端点）
    base: "https://llm-mhzccuzghu9iwggm.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.8-flash",
  },
};

const normalizeProvider = (v: string | undefined): AiProvider =>
  PROVIDER_ALIASES[(v ?? "").trim().toLowerCase()] ?? "deepseek";

/** 当前 env 选定的供应商（决定无预设时的默认路由） */
export function envProvider(): AiProvider {
  return normalizeProvider(process.env.LLM_PROVIDER);
}

/** 该供应商的 key 是否已配置（决定预设是否对访客可见） */
export function providerAvailable(p: AiProvider): boolean {
  const key =
    p === "glm" ? process.env.GLM_API_KEY : p === "qwen" ? process.env.QWEN_API_KEY : process.env.DEEPSEEK_API_KEY;
  return !!key?.trim();
}

/** 解析某预设/供应商最终生效的模型名（优先级与 getLlmRequest 一致，供前台展示真实模型名） */
export function resolveProviderModel(provider: AiProvider, override?: string): string {
  const def = PROVIDER_DEFAULTS[provider];
  const providerModelEnv =
    provider === "glm" ? process.env.GLM_MODEL : provider === "qwen" ? process.env.QWEN_MODEL : process.env.DEEPSEEK_MODEL;
  return process.env.LLM_MODEL ?? override?.trim() ?? providerModelEnv ?? def.model;
}

/**
 * 解析当前生效的 LLM 配置；未配置任何 key 时返回 null（调用方返回 503）。
 * - provider：预设指定的供应商（默认 env LLM_PROVIDER）
 * - model：预设的模型覆盖（LLM_MODEL env 全局覆盖仍最高优先）
 * - level：思考强度档位（非法/不支持时回退该模型第一个可用档）
 */
export function getLlmRequest(opts?: {
  provider?: AiProvider;
  model?: string;
  level?: ThinkingLevel;
}): LlmRequest | null {
  const provider = opts?.provider ?? envProvider();
  const def = PROVIDER_DEFAULTS[provider];

  const base =
    process.env.LLM_BASE_URL ??
    (provider === "glm"
      ? (process.env.GLM_API_BASE ?? def.base)
      : provider === "qwen"
        ? (process.env.QWEN_API_BASE ?? def.base)
        : (process.env.DEEPSEEK_API_BASE ?? def.base));
  const key =
    process.env.LLM_API_KEY ??
    (provider === "glm"
      ? process.env.GLM_API_KEY
      : provider === "qwen"
        ? process.env.QWEN_API_KEY
        : process.env.DEEPSEEK_API_KEY);

  const chosen = resolveProviderModel(provider, opts?.model);
  const spec = thinkingSpec(provider, chosen);
  const level = spec.resolve(opts?.level);
  const { extraBody, legacyReasoner } = spec.apply(level);
  // 旧版 deepseek 双模型制：思考档 = 切 reasoner 模型
  const model = legacyReasoner
    ? (process.env.DEEPSEEK_REASONER_MODEL ?? def.thinkingModel ?? "deepseek-reasoner")
    : chosen;

  if (!base || !key) return null;
  return { base, key, model, extraBody, level };
}

/**
 * 从后台预设里解析本次对话用哪个模型：
 * 访客请求的 id（需后台开了访客选择且该供应商已配 key）→ 后台默认 → 与 env
 * LLM_PROVIDER 匹配的 → 第一个可用的。全部不可用返回 null（调用方 503）。
 */
export function resolveAiChatChoice(cfg: AiChatConfig, requestedId?: unknown): AiChatChoice | null {
  const available = cfg.choices.filter(
    (c) => c.id?.trim() && c.label?.trim() && providerAvailable(c.provider),
  );
  if (!available.length) return null;

  const wanted = typeof requestedId === "string" ? requestedId.trim().slice(0, 64) : "";
  if (cfg.allowVisitorChoice && wanted) {
    const hit = available.find((c) => c.id === wanted);
    if (hit) return hit;
  }
  const def = available.find((c) => c.id === cfg.defaultChoice);
  if (def) return def;
  const envMatch = available.find((c) => c.provider === envProvider());
  return envMatch ?? available[0]!;
}

/** 未配置时的统一提示（三个调用点的 503 文案） */
export const LLM_NOT_CONFIGURED_MSG =
  "站长还没有配置 AI（.env 里设置 DEEPSEEK_API_KEY / GLM_API_KEY / QWEN_API_KEY 任意一家），配置后重启服务生效";
