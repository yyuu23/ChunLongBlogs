"use client";

import { useMemo } from "react";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/** 亮色主题粒子：樱花瓣（DOM + CSS 关键帧 + 负延迟，进入页面即满屏） */
export function Sakura({ count = 26 }: { count?: number }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: rand(0, 100),
        duration: rand(8, 14),
        delay: -rand(0, 14),
        sway: rand(-8, 8),
        size: rand(8, 14),
        opacity: rand(0.5, 0.9),
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      {petals.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={{
            left: `${p.left}vw`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            ["--sway" as string]: `${p.sway}vw`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 暗色主题粒子：萤火虫（呼吸 + 漂浮双关键帧叠加） */
export function Fireflies({ count = 30 }: { count?: number }) {
  const flies = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: rand(2, 98),
        top: rand(5, 95),
        size: rand(3.5, 6.5),
        breatheDuration: rand(2.2, 4.5),
        breatheDelay: -rand(0, 5),
        floatAnim: ["float-1", "float-2", "float-3"][i % 3],
        floatDuration: rand(9, 18),
        floatDelay: -rand(0, 18),
        hue: Math.random() > 0.7 ? "firefly" : "firefly firefly-warm",
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      {flies.map((f, i) => (
        <span
          key={i}
          className={f.hue}
          style={{
            left: `${f.left}vw`,
            top: `${f.top}vh`,
            width: f.size,
            height: f.size,
            animationName: `firefly-breathe, ${f.floatAnim}`,
            animationDuration: `${f.breatheDuration}s, ${f.floatDuration}s`,
            animationDelay: `${f.breatheDelay}s, ${f.floatDelay}s`,
            animationTimingFunction: "ease-in-out, ease-in-out",
            animationIterationCount: "infinite, infinite",
          }}
        />
      ))}
    </div>
  );
}
