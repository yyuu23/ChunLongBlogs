"use client";

import { useEffect, useRef, useState } from "react";
import { Sakura, Fireflies, Leaves, Snow } from "@/components/effects/Particles";
import type { ActiveParticle } from "@/lib/particle-theme";

/**
 * 瓶子投影仪：故事卡「投影到夜空」派发 cl-bottle-project 事件后，
 * 把瓶子里的季节释放在全站——樱花瓶下一场 30 秒的樱花雨。
 * 复用四套现成粒子层（count 加强），pointer-events-none 不挡任何交互。
 */
const LAYERS: Record<ActiveParticle, (props: { count?: number }) => React.ReactNode> = {
  sakura: Sakura,
  firefly: Fireflies,
  leaf: Leaves,
  snow: Snow,
};

const DURATION_MS = 30_000;

export function BottleProjection() {
  const [active, setActive] = useState<{ theme: ActiveParticle; key: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onProject = (e: Event) => {
      const theme = (e as CustomEvent<{ theme?: string }>).detail?.theme as ActiveParticle | undefined;
      if (!theme || !LAYERS[theme]) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setLeaving(false);
      setActive({ theme, key: Date.now() });
      timerRef.current = setTimeout(() => {
        setLeaving(true); // 1s 淡出后再卸载
        timerRef.current = setTimeout(() => setActive(null), 1100);
      }, DURATION_MS);
    };
    window.addEventListener("cl-bottle-project", onProject);
    return () => {
      window.removeEventListener("cl-bottle-project", onProject);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!active) return null;
  const Layer = LAYERS[active.theme];
  return (
    <div
      key={active.key}
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[2] transition-opacity duration-1000 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <Layer count={42} />
    </div>
  );
}
