"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AccentKey = "violet" | "rose" | "emerald" | "amber" | "cyan";

export interface AccentPreset {
  key: AccentKey;
  label: string;
  from: string;
  to: string;
}

export const ACCENTS: AccentPreset[] = [
  { key: "violet", label: "星紫", from: "#6366f1", to: "#a855f7" },
  { key: "rose", label: "樱粉", from: "#f43f5e", to: "#ec4899" },
  { key: "emerald", label: "青竹", from: "#10b981", to: "#0d9488" },
  { key: "amber", label: "暖阳", from: "#f59e0b", to: "#f97316" },
  { key: "cyan", label: "晴空", from: "#06b6d4", to: "#3b82f6" },
];

interface AccentCtx {
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
}

const Ctx = createContext<AccentCtx>({ accent: "violet", setAccent: () => {} });

export const useAccent = () => useContext(Ctx);

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentKey>("violet");

  useEffect(() => {
    const saved = document.documentElement.dataset.accent as AccentKey | undefined;
    if (saved && ACCENTS.some((a) => a.key === saved)) setAccentState(saved);
  }, []);

  const setAccent = useCallback((a: AccentKey) => {
    setAccentState(a);
    document.documentElement.dataset.accent = a;
    try {
      localStorage.setItem("cl-accent", a);
    } catch {}
  }, []);

  return <Ctx.Provider value={{ accent, setAccent }}>{children}</Ctx.Provider>;
}
