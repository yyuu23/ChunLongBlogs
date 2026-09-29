export const cleanStr = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

export const cleanLimit = (value: unknown, fallback: number, max: number): number => {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(Math.max(number, 1), max);
};

import { dateKey } from "@/lib/shared/date-key";

/** AI 工具参数里的日期展示（北京时间业务日——受众为中文用户，UTC 会在凌晨差一天） */
export const dayOf = (date: Date | null | undefined) => date ? dateKey(date) : null;
