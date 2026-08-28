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

const DEFAULTS: EffectFlags = { particles: true, clickBurst: true, splash: true };

interface EffectCtx {
  effects: EffectFlags;
  toggle: (key: keyof EffectFlags) => void;
  hydrated: boolean;
}

const Ctx = createContext<EffectCtx>({ effects: DEFAULTS, toggle: () => {}, hydrated: false });

export const useEffects = () => useContext(Ctx);

export function EffectProvider({ children }: { children: ReactNode }) {
  const [effects, setEffects] = useState<EffectFlags>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cl-effects");
      let next = DEFAULTS;
      if (raw) {
        next = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<EffectFlags>) };
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

  return (
    <Ctx.Provider value={{ effects, toggle, hydrated }}>{children}</Ctx.Provider>
  );
}
