/**
 * 自动封面：没上传封面图的文章，用 slug 哈希生成一张稳定的渐变封面。
 *
 * 为什么是 DOM/CSS 而不是 next/og 生成 PNG：Satori 内置字体不含中文字形，
 * 仓库里也没有 .ttf/.otf 可用（Google Fonts 在国内还拉不通），生成的 PNG
 * 中文会变成豆腐块。改成纯 DOM 后由浏览器用系统字体渲染，中文正常。
 * （后续已在 public/fonts/simhei.ttf 放入黑体，/api/og/[slug] 用它为
 * 无封面文章出分享卡 PNG；线上封面仍是本组件渲染，二者共用 pickAutoCoverStyle。）
 *
 * 无 hook、无 "use client"：服务端组件与客户端组件都能直接用；
 * 配色只由 slug 决定——同一篇文章改标题配色不变，也不会 hydration 抖动。
 */

/** 柔和渐变 + 深色文字，取自站点 gradientPalette 的调性 */
const PALETTES: { from: string; to: string; ink: string }[] = [
  { from: "#a18cd1", to: "#fbc2eb", ink: "#3f2a66" },
  { from: "#a1c4fd", to: "#c2e9fb", ink: "#1c3a5e" },
  { from: "#ffecd2", to: "#fcb69f", ink: "#6d3512" },
  { from: "#84fab0", to: "#8fd3f4", ink: "#12513c" },
  { from: "#fbc2eb", to: "#a6c1ee", ink: "#4b2b5c" },
  { from: "#f6d365", to: "#fda085", ink: "#6d4410" },
  { from: "#5ee7df", to: "#b490ca", ink: "#13504c" },
  { from: "#d4fc79", to: "#96e6a1", ink: "#255e2b" },
];

/** FNV-1a：短字符串够分散，且服务端/客户端结果一致 */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export interface AutoCoverStyle {
  palette: { from: string; to: string; ink: string };
  angle: number;
  blobA: { x: number; y: number; r: number };
  blobB: { x: number; y: number; r: number };
  bandY: number;
}

/** 由 seed（一般传 slug）推出封面的全部视觉参数；组件与 OG 分享图路由共用，保证视觉一致 */
export function pickAutoCoverStyle(seed: string): AutoCoverStyle {
  const h = hash(seed);
  return {
    palette: PALETTES[h % PALETTES.length]!,
    // 渐变角度与两个装饰圆的位置都从哈希里取，避免所有封面长得一样
    angle: 105 + ((h >> 3) % 70),
    blobA: { x: 8 + ((h >> 5) % 30), y: 10 + ((h >> 9) % 30), r: 34 + ((h >> 13) % 18) },
    blobB: { x: 60 + ((h >> 7) % 30), y: 55 + ((h >> 11) % 35), r: 26 + ((h >> 17) % 16) },
    bandY: 30 + ((h >> 19) % 30),
  };
}

export function AutoCover({
  title,
  seed = "",
  variant = "card",
}: {
  title: string;
  /** 参与哈希的因子，一般传 slug：slug 天然唯一，且标题修改不会改变配色 */
  seed?: string;
  /** card：列表卡片（小图）；wide：详情页横幅（大图） */
  variant?: "card" | "wide";
}) {
  const { palette, angle, blobA, blobB, bandY } = pickAutoCoverStyle(seed);
  const wide = variant === "wide";

  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ backgroundImage: `linear-gradient(${angle}deg, ${palette.from}, ${palette.to})` }}
    >
      {/* 装饰光斑：两颗错位的柔光圆 + 一道斜向高光 */}
      <span
        className="absolute rounded-full bg-white/30 blur-2xl"
        style={{
          left: `${blobA.x}%`,
          top: `${blobA.y}%`,
          width: `${blobA.r}%`,
          aspectRatio: "1",
        }}
      />
      <span
        className="absolute rounded-full bg-white/20 blur-xl"
        style={{
          left: `${blobB.x}%`,
          top: `${blobB.y}%`,
          width: `${blobB.r}%`,
          aspectRatio: "1",
        }}
      />
      <span
        className="absolute -inset-x-1/4 h-1/3 -rotate-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
        style={{ top: `${bandY}%` }}
      />

      {/* 标题：line-clamp 兜住超长标题，中文由系统字体渲染 */}
      <p
        className={`relative text-center font-serif font-bold leading-snug ${
          wide
            ? "line-clamp-2 px-10 text-xl drop-shadow-sm md:text-3xl"
            : "line-clamp-3 px-5 text-[15px] sm:text-base"
        }`}
        style={{ color: palette.ink }}
      >
        {title}
      </p>
    </div>
  );
}
