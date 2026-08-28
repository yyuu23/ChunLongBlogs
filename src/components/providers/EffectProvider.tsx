"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface EffectFlags {
  particles: boolean;
  clickBurst: boolean;
  splash: boolean;
}

/** 粒子主题：auto = 亮色樱花/暗色萤火虫（默认），其余为强制指定 */
export type ParticleTheme = "auto" | "sakura" | "firefly" | "leaf" | "snow" | "off";

export const PARTICLE_THEMES: { key: ParticleTheme; label: string; emoji: string }[] = [
  { key: "auto", label: "日夜自动", emoji: "🌗" },
  { key: "sakura", label: "樱花", emoji: "🌸" },
  { key: "firefly", label: "萤火虫", emoji: "✨" },
  { key: "leaf", label: "落叶", emoji: "🍁" },
  { key: "snow", label: "落雪", emoji: "❄️" },
  { key: "off", label: "关闭", emoji: "🚫" },
];

const DEFAULTS: EffectFlags = { particles: true, clickBurst: true, splash: true };

interface EffectCtx {
  effects: EffectFlags;
  toggle: (key: keyof EffectFlags) => void;
  particleTheme: ParticleTheme;
  setParticleTheme: (t: ParticleTheme) => void;
  hydrated: boolean;
}

const Ctx = createContext<EffectCtx>({
  effects: DEFAULTS,
  toggle: () => {},
  particleTheme: "auto",
  setParticleTheme: () => {},
  hydrated: false,
});

export const useEffects = () => useContext(Ctx);

export function EffectProvider({ children }: { children: ReactNode }) {
  const [effects, setEffects] = useState<EffectFlags>(DEFAULTS);
  const [particleTheme, setParticleThemeState] = useState<ParticleTheme>("auto");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cl-effects");
      let next = DEFAULTS;
      if (raw) {
        next = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<EffectFlags>) };
      }
      const savedTheme = localStorage.getItem("cl-particle-theme") as ParticleTheme | null;
      if (savedTheme && PARTICLE_THEMES.some((t) => t.key === savedTheme)) {
        setParticleThemeState(savedTheme);
      }
      // 尊重系统减少动态偏好
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        next = { particles: false, clickBurst: false, splash: false };
      }
      setEffects(next);
    } catch {}
    setHydrated(true);
  }, []);

  const toggle = (key: keyof EffectFlags) => {
    setEffects((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("cl-effects", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setParticleTheme = (t: ParticleTheme) => {
    setParticleThemeState(t);
    try {
      localStorage.setItem("cl-particle-theme", t);
    } catch {}
  };

  return (
    <Ctx.Provider value={{ effects, toggle, particleTheme, setParticleTheme, hydrated }}>
      {children}
    </Ctx.Provider>
  );
}
