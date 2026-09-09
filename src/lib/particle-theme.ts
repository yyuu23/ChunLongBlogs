import { festivalOf, festivalParticleOf } from "@/lib/festivals";

/**
 * 粒子主题的统一展开逻辑（客户端安全，无组件依赖）。
 * 此前 auto/season 的展开在 Effects.tsx（渲染）与 track.ts 的
 * currentParticleTheme()（瓶子记录主题）两处平行实现，口径易分叉——
 * 现统一在这里，两处调用同一 resolver。
 *
 * 节日优先层：当天命中节气/农历节日时，auto/season 模式返回该节日的主题
 * （如冬至飘雪、七夕萤火）。只在内存里覆盖一次，不改 localStorage 的用户
 * 偏好，手动选定具体主题/关闭的用户完全不受影响。
 */

/** 具体粒子层（auto/season/off 之外的实体主题） */
export type ActiveParticle = "sakura" | "firefly" | "leaf" | "snow";

/** 粒子主题模式（EffectProvider 的 ParticleTheme 与此结构一致） */
export type ParticleTheme = "auto" | "season" | ActiveParticle | "off";

export function resolveParticleTheme(
  mode: ParticleTheme,
  isNight: boolean,
  now = new Date(),
): ActiveParticle | null {
  if (mode === "off") return null;
  // 手动选定具体主题：用户偏好优先，节日不覆盖
  if (mode !== "auto" && mode !== "season") return mode;
  const fest = festivalOf(now);
  if (fest) return festivalParticleOf(fest);
  if (mode === "auto") return isNight ? "firefly" : "sakura";
  const month = now.getMonth() + 1;
  return month >= 3 && month <= 5
    ? "sakura"
    : month >= 6 && month <= 8
      ? "firefly"
      : month >= 9 && month <= 11
        ? "leaf"
        : "snow";
}
