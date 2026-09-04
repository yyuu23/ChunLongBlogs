import { db } from "@/lib/db";
import { bottles } from "@/lib/db/schema";

/** 瓶内季节 = 获得时的粒子主题 */
export const BOTTLE_THEMES = ["sakura", "firefly", "leaf", "snow"] as const;
export type BottleTheme = (typeof BOTTLE_THEMES)[number];
export type BottleKind = "star" | "achievement" | "festival";

export function normalizeTheme(v: unknown): BottleTheme {
  return BOTTLE_THEMES.includes(v as BottleTheme) ? (v as BottleTheme) : "sakura";
}

/** 从埋点请求顶层的 __meta 里取粒子主题（trackEvent 统一附 __meta.theme） */
export function themeFromMeta(meta: unknown): BottleTheme {
  return normalizeTheme((meta as { theme?: unknown } | undefined)?.theme);
}

/**
 * 幂等发瓶：uniqueIndex(visitorId, kind, refKey) + onConflictDoNothing。
 * 任何来源（留星/成就/节日）重复触发都不会产生重复瓶子。
 */
export async function grantBottle(
  visitorId: string,
  kind: BottleKind,
  refKey: string | number,
  theme: unknown,
  title = "",
) {
  const vid = visitorId.trim().slice(0, 64);
  if (!vid) return;
  await db
    .insert(bottles)
    .values({
      visitorId: vid,
      kind,
      refKey: String(refKey).slice(0, 64),
      title: title.slice(0, 60),
      theme: normalizeTheme(theme),
    })
    .onConflictDoNothing();
}
