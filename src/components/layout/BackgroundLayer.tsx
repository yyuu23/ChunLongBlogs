"use client";

import { useEffect, useState } from "react";

interface BackgroundLayerProps {
  mode: "image" | "gradient";
  images: string[];
  palette: string[];
  /** 遮罩浓度 0–1（暗色模式自动加深 1.6 倍保证正文可读） */
  maskOpacity: number;
  /** 磨砂模糊 px */
  maskBlur: number;
}

/**
 * 全站分层背景（固定定位，z-0）：
 * 背景图轮播（交叉淡入 + Ken Burns）→ 可调遮罩 → 模糊光球
 * mode=gradient 时只保留流动渐变 + 光球
 */
export function BackgroundLayer({
  mode,
  images,
  palette,
  maskOpacity,
  maskBlur,
}: BackgroundLayerProps) {
  const slides = images.length ? images : ["/assets/bg/bg-1.svg"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (mode !== "image" || slides.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      9000,
    );
    return () => clearInterval(timer);
  }, [mode, slides.length]);

  const gradient = `linear-gradient(-45deg, ${(palette.length ? palette : ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"]).join(", ")})`;

  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden">
      {mode === "image" ? (
        <>
          {slides.map((src, i) => (
            <div
              key={src + i}
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out"
              style={{
                backgroundImage: `url(${src})`,
                opacity: i === index ? 1 : 0,
                animation: i === index ? "kenburns 12s ease-out forwards" : undefined,
              }}
            />
          ))}
          {/* 遮罩：浓度/磨砂由后台配置。亮色白遮罩；暗色用较淡的深色遮罩（保留背景图可见度） */}
          <div
            className="absolute inset-0 bg-[var(--bg-mask-light)] dark:bg-[var(--bg-mask-dark)]"
            style={
              {
                "--bg-mask-light": `rgba(255,255,255,${maskOpacity})`,
                "--bg-mask-dark": `rgba(2,6,23,${Math.min(0.8, 0.35 + maskOpacity)})`,
                backdropFilter: maskBlur > 0 ? `blur(${maskBlur}px)` : undefined,
                WebkitBackdropFilter: maskBlur > 0 ? `blur(${maskBlur}px)` : undefined,
              } as React.CSSProperties
            }
          />

        </>
      ) : (
        /* 流动渐变：原先是 400% 尺寸背景动画 background-position（每帧全屏重绘）。
         * 数学等价的合成层写法：渲染一个 400vw×400vh 的子层并垂直居中（原
         * background-position 垂直恒为 50% ⇔ top: -150vh），水平用 transform
         * 平移 0 → -300vw（= 原 0% → 100% 的图像偏移 X%×(100vw-400vw)）。
         * 渐变/角度/节奏完全相同，从主线程重绘降为纯合成器动画 */
        <div
          className="absolute left-0 -top-[150vh] h-[400vh] w-[400vw] will-change-transform"
          style={{
            backgroundImage: gradient,
            backgroundSize: "100% 100%",
            animation: "gradient-move 16s ease infinite",
          }}
        />
      )}

      {/* 模糊光球：两种模式下都叠加，制造层次 */}
      <div
        className="absolute -top-32 -left-24 h-[55vmax] w-[55vmax] rounded-full opacity-25 mix-blend-overlay blur-[100px] dark:opacity-20"
        style={{
          background: "radial-gradient(circle, #818cf8 0%, transparent 70%)",
          animation: "orb-float-1 22s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-40 -right-20 h-[60vmax] w-[60vmax] rounded-full opacity-25 mix-blend-overlay blur-[100px] dark:opacity-20"
        style={{
          background: "radial-gradient(circle, #f472b6 0%, transparent 70%)",
          animation: "orb-float-2 26s ease-in-out infinite",
        }}
      />
    </div>
  );
}
