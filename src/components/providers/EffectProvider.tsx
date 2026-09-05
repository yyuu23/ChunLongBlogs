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
  selectionSparkle: boolean;
  mascot: boolean;
  heroTypewriter: boolean;
}

/** 粒子主题：auto = 亮色樱花/暗色萤火虫（默认），season = 按月份自动，其余为强制指定 */
export type ParticleTheme =
  | "auto"
  | "season"
  | "sakura"
  | "firefly"
  | "leaf"
  | "snow"
  | "off";

export const PARTICLE_THEMES: { key: ParticleTheme; label: string; emoji: string }[] = [
  { key: "auto", label: "日夜自动", emoji: "🌗" },
  { key: "season", label: "季节", emoji: "🌻" },
  { key: "sakura", label: "樱花", emoji: "🌸" },
  { key: "firefly", label: "萤火虫", emoji: "✨" },
  { key: "leaf", label: "落叶", emoji: "🍁" },
  { key: "snow", label: "落雪", emoji: "❄️" },
  { key: "off", label: "关闭", emoji: "🚫" },
];

const DEFAULTS: EffectFlags = {
  particles: true,
  clickBurst: true,
  splash: true,
  selectionSparkle: true,
  mascot: true,
  heroTypewriter: true,
};

interface EffectCtx {
  effects: EffectFlags;
  toggle: (key: keyof EffectFlags) => void;
  particleTheme: ParticleTheme;
  setParticleTheme: (t: ParticleTheme) => void;
  hydrated: boolean;
  /** 深夜（0-4 点）：首帧类名由 initScript 静态添加（微缓存安全），这里供 React 侧响应式使用 */
  isNight: boolean;
}

const Ctx = createContext<EffectCtx>({
  effects: DEFAULTS,
  toggle: () => {},
  particleTheme: "auto",
  setParticleTheme: () => {},
  hydrated: false,
  isNight: false,
});

export const useEffects = () => useContext(Ctx);

export function EffectProvider({ children }: { children: ReactNode }) {
  const [effects, setEffects] = useState<EffectFlags>(DEFAULTS);
  const [particleTheme, setParticleThemeState] = useState<ParticleTheme>("auto");
  const [hydrated, setHydrated] = useState(false);
  const [isNight, setIsNight] = useState(false);

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
        next = { particles: false, clickBurst: false, splash: false, selectionSparkle: false, mascot: false, heroTypewriter: false };
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

  // 深夜时段（0-4 点）：与 initScript 首帧加的类保持同步（幂等 toggle），
  // 60s 轮询跨零点无缝切换。不加用户开关——受 particles 开关与 reduced-motion 管辖。
  useEffect(() => {
    const apply = () => {
      const night = new Date().getHours() < 5;
      setIsNight(night);
      document.documentElement.classList.toggle("cl-night", night);
    };
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Ctx.Provider value={{ effects, toggle, particleTheme, setParticleTheme, hydrated, isNight }}>
      {children}
    </Ctx.Provider>
  );
}
