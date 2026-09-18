export const cleanStr = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

export const cleanLimit = (value: unknown, fallback: number, max: number): number => {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(Math.max(number, 1), max);
};

export const dayOf = (date: Date | null | undefined) => date ? date.toISOString().slice(0, 10) : null;
