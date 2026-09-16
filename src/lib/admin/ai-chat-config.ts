import { resolveProviderModel } from "@/lib/llm";
import { thinkingSpec, type ThinkingLevel } from "@/lib/llm-thinking";
import type { AiChatConfig } from "@/lib/site";

const AI_PROVIDERS = new Set(["deepseek", "glm", "qwen"]);
const TOOL_NAMES = new Set([
  "list_posts",
  "get_post",
  "list_moments",
  "list_albums",
  "site_stats",
  "list_music",
  "web_search",
]);

function clampInt(value: unknown, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(Math.floor(number), 0), max) : 0;
}

function optionalCost(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.min(Math.round(number), 9999) : undefined;
}

function optionalMoney(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.min(Math.round(number * 1000) / 1000, 9999)
    : undefined;
}

function optionalMultiplier(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.min(Math.floor(number * 10) / 10, 999)
    : undefined;
}

function optionalDecimal(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(Math.round(number * 10) / 10, max))
    : undefined;
}

export function sanitizeAiChatConfig(
  input: AiChatConfig,
): { ok: true; config: AiChatConfig } | { ok: false; error: string } {
  const choices = (Array.isArray(input.choices) ? input.choices : [])
    .slice(0, 6)
    .map((choice) => {
      const promo = choice.promo
        ? {
            originalCost: optionalCost(choice.promo.originalCost),
            label:
              typeof choice.promo.label === "string" && choice.promo.label.trim()
                ? choice.promo.label.trim().slice(0, 12)
                : undefined,
            until: /^\d{4}-\d{2}-\d{2}$/.test(String(choice.promo.until ?? ""))
              ? String(choice.promo.until).slice(0, 10)
              : undefined,
          }
        : undefined;
      const hasPromo = promo && (promo.originalCost !== undefined || promo.label || promo.until);
      const apiPrice = choice.apiPrice
        ? {
            input: optionalMoney(choice.apiPrice.input),
            output: optionalMoney(choice.apiPrice.output),
            cache: optionalMoney(choice.apiPrice.cache),
            outputMult: optionalDecimal(choice.apiPrice.outputMult, 1, 20),
          }
        : undefined;
      const hasApiPrice = apiPrice && (apiPrice.input !== undefined || apiPrice.output !== undefined);
      return {
        id: String(choice.id ?? "").trim().slice(0, 64),
        label: String(choice.label ?? "").trim().slice(0, 24),
        provider: (AI_PROVIDERS.has(choice.provider) ? choice.provider : "deepseek") as AiChatConfig["choices"][number]["provider"],
        model:
          typeof choice.model === "string" && choice.model.trim()
            ? choice.model.trim().slice(0, 64)
            : undefined,
        cost: optionalCost(choice.cost),
        apiPrice: hasApiPrice ? apiPrice : undefined,
        promo: hasPromo ? promo : undefined,
      };
    })
    .filter((choice) => choice.id && choice.label);

  const seenIds = new Set<string>();
  const uniqueChoices = choices.filter((choice) => {
    if (seenIds.has(choice.id)) return false;
    seenIds.add(choice.id);
    return true;
  });
  if (!uniqueChoices.length) return { ok: false, error: "至少保留一个有效的模型预设" };

  const defaultChoice = uniqueChoices.some((choice) => choice.id === input.defaultChoice)
    ? input.defaultChoice
    : uniqueChoices[0]!.id;
  const selected = uniqueChoices.find((choice) => choice.id === defaultChoice)!;
  const efforts = thinkingSpec(
    selected.provider,
    resolveProviderModel(selected.provider, selected.model),
  ).levels;
  const defaultEffort = efforts.includes(input.defaultEffort as ThinkingLevel)
    ? input.defaultEffort
    : efforts[0]!;

  const tools = Object.fromEntries(
    Object.entries(input.tools ?? {}).filter(([name]) => TOOL_NAMES.has(name)),
  );
  const customNames = new Set<string>();
  const customTools = (Array.isArray(input.customTools) ? input.customTools : [])
    .slice(0, 6)
    .map((tool, index) => ({
      id: String(tool?.id ?? "").trim().slice(0, 64) || `tool-${index + 1}`,
      name: String(tool?.name ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48),
      description: String(tool?.description ?? "").trim().slice(0, 200),
      endpoint: String(tool?.endpoint ?? "").trim().slice(0, 300),
    }))
    .filter((tool) => {
      if (
        !tool.name ||
        !/^https?:\/\//.test(tool.endpoint) ||
        TOOL_NAMES.has(tool.name) ||
        customNames.has(tool.name)
      ) {
        return false;
      }
      customNames.add(tool.name);
      return true;
    });

  const creditInput = (input.credits ?? {}) as Partial<NonNullable<AiChatConfig["credits"]>>;
  const credits = {
    enabled: creditInput.enabled !== false,
    dailyGrant: clampInt(creditInput.dailyGrant ?? 500, 99999),
    checkinBonus: clampInt(creditInput.checkinBonus ?? 100, 99999),
    levelBonusPerLevel: clampInt(creditInput.levelBonusPerLevel ?? 5, 999),
    peakMultiplier:
      creditInput.peakMultiplier === undefined
        ? undefined
        : optionalMultiplier(creditInput.peakMultiplier),
    pricingMarkup: optionalDecimal(creditInput.pricingMarkup, 0, 99),
    estInputTokens:
      creditInput.estInputTokens === undefined
        ? undefined
        : clampInt(creditInput.estInputTokens, 99999),
    estOutputTokens:
      creditInput.estOutputTokens === undefined
        ? undefined
        : clampInt(creditInput.estOutputTokens, 99999),
  };
  const effortCost = Object.fromEntries(
    Object.entries(input.effortCost ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => [name, optionalMultiplier(value)]),
  );

  return {
    ok: true,
    config: {
      choices: uniqueChoices,
      defaultChoice,
      defaultEffort,
      allowVisitorChoice: input.allowVisitorChoice === true,
      perVisitorHourly: clampInt(input.perVisitorHourly, 999),
      perVisitorDaily: clampInt(input.perVisitorDaily, 999),
      tools,
      customTools,
      ...(Object.keys(effortCost).length ? { effortCost } : {}),
      credits,
    },
  };
}
