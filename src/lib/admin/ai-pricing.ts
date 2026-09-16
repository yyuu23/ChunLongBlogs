import type { AiChatChoice } from "@/lib/site";

export function budgetYuanToCredits(value: unknown): number | null {
  const yuan = Number(value);
  if (!Number.isFinite(yuan) || yuan <= 0) return null;
  const raw = yuan * 1000;
  return raw >= 1000 ? Math.round(raw / 100) * 100 : Math.round(raw / 50) * 50;
}

export function suggestModelCredits(
  choice: AiChatChoice,
  options: { markup: number; inputTokens: number; outputTokens: number },
): number | null {
  const price = choice.apiPrice;
  if (!price?.input || !price.output) return null;
  const effectiveInputPrice = price.cache
    ? price.cache * 0.5 + price.input * 0.5
    : price.input;
  const costYuan =
    (options.inputTokens * effectiveInputPrice +
      options.outputTokens * (price.outputMult ?? 1) * price.output) /
    1_000_000;
  return Math.max(1, Math.ceil(costYuan * 1000 * options.markup));
}
