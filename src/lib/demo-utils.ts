/** 实验台 demo 公共小工具（纯浏览器端）：主题色探针 + 颜色变换。
 *  各 demo 的统一工程约束见 Fireworks.tsx 头注——这里只抽它们共用的小函数。 */

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** rgb() 字符串 → [r,g,b]（读主题色探针用） */
export function parseRgb(css: string): [number, number, number] | null {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** 向白色方向提亮 t（0~1） */
export function shift([r, g, b]: [number, number, number], t: number): string {
  const f = (v: number) => Math.round(Math.min(255, v + (255 - v) * t));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** 读站点主题色（text-accent 类 → 计算色），失败回落 fallback（默认经典暖金） */
export function accentColor(fallback = "rgb(255,196,110)"): string {
  try {
    const probe = document.createElement("span");
    probe.className = "text-accent";
    probe.style.position = "fixed";
    probe.style.opacity = "0";
    document.body.appendChild(probe);
    const rgb = parseRgb(getComputedStyle(probe).color);
    probe.remove();
    if (rgb) return `rgb(${rgb.join(",")})`;
  } catch {}
  return fallback;
}
