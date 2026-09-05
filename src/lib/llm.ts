import type { AiChatConfig, AiChatChoice, AiProvider } from "@/lib/site";

/**
 * 全站 LLM 供应商统一解析（/api/chat、/api/chat/memory、后台 AI 编辑共用）。
 * 供应商 key 全部放 .env（DEEPSEEK_API_KEY / GLM_API_KEY / QWEN_API_KEY），
 * 哪家暴露给访客、默认用哪家、思考开关由 /admin/ai-chat 的预设（siteConfigs.aiChat）决定。
 *
 * 思考模式按供应商自动适配生效方式：
 * - glm：请求参数 thinking: {type: "enabled"|"disabled"}
 * - qwen：请求参数 enable_thinking: boolean（阿里云 MaaS OpenAI 兼容协议）
 * - deepseek：切换到 reasoner 模型（DEEPSEEK_REASONER_MODEL，默认 deepseek-reasoner）
 */

export interface LlmRequest {
  base: string;
  key: string;
  model: string;
  /** 追加到请求体的供应商特有参数（思考开关等） */
  extraBody?: Record<string, unknown>;
  /** 是否处于思考模式（调用方可据此放宽超时） */
  thinking: boolean;
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
    model: "deepseek-chat",
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

/**
 * 解析当前生效的 LLM 配置；未配置任何 key 时返回 null（调用方返回 503）。
 * - provider：预设指定的供应商（默认 env LLM_PROVIDER）
 * - model：预设的模型覆盖（LLM_MODEL env 全局覆盖仍最高优先）
 * - thinking：思考开关（显式入参 > 预设/环境默认）
 */
export function getLlmRequest(opts?: {
  provider?: AiProvider;
  model?: string;
  thinking?: boolean;
}): LlmRequest | null {
  const provider = opts?.provider ?? envProvider();
  const thinkEnabled = opts?.thinking ?? process.env.LLM_THINKING === "on";
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
  const providerModelEnv =
    provider === "glm"
      ? process.env.GLM_MODEL
      : provider === "qwen"
        ? process.env.QWEN_MODEL
        : process.env.DEEPSEEK_MODEL;

  let model: string;
  let extraBody: Record<string, unknown> | undefined;
  if (provider === "glm") {
    model = process.env.LLM_MODEL ?? opts?.model ?? providerModelEnv ?? def.model;
    extraBody = { thinking: { type: thinkEnabled ? "enabled" : "disabled" } };
  } else if (provider === "qwen") {
    model = process.env.LLM_MODEL ?? opts?.model ?? providerModelEnv ?? def.model;
    extraBody = { enable_thinking: thinkEnabled };
  } else {
    model =
      process.env.LLM_MODEL ??
      opts?.model ??
      providerModelEnv ??
      (thinkEnabled ? (process.env.DEEPSEEK_REASONER_MODEL ?? def.thinkingModel ?? "deepseek-reasoner") : def.model);
  }

  if (!base || !key) return null;
  return { base, key, model, extraBody, thinking: thinkEnabled };
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
