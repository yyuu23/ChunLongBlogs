"use client";

import { useEffect, useState } from "react";

interface BackgroundLayerProps {
  mode: "image" | "gradient";
  images: string[];
  palette: string[];
}

/**
 * 全站分层背景（固定定位，z-0）：
 * 背景图轮播（交叉淡入 + Ken Burns）→ 毛玻璃遮罩 → 模糊光球
 * mode=gradient 时只保留流动渐变 + 光球
 */
export function BackgroundLayer({ mode, images, palette }: BackgroundLayerProps) {
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
          {/* 毛玻璃遮罩：让任何背景图都变得柔和 */}
          <div className="absolute inset-0 bg-white/35 backdrop-blur-[18px] dark:bg-slate-950/55" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: gradient,
            backgroundSize: "400% 400%",
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
