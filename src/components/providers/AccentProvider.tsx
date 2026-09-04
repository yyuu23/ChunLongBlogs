"use client";

import { trackEvent } from "@/lib/track";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** "custom" = 自定义色相（hue 存 localStorage["cl-custom-hue"]，进 custom 即生效） */
export type AccentKey =
  | "violet"
  | "rose"
  | "emerald"
  | "amber"
  | "cyan"
  | "custom";

export type AccentPresetKey = Exclude<AccentKey, "custom">;

export interface AccentPreset {
  key: AccentPresetKey;
  label: string;
  from: string;
  to: string;
}

/** 预设圆点用（custom 由色相滑杆表达，不在圆点列表里） */
export const ACCENTS: AccentPreset[] = [
  { key: "violet", label: "星紫", from: "#6366f1", to: "#a855f7" },
  { key: "rose", label: "樱粉", from: "#f43f5e", to: "#ec4899" },
  { key: "emerald", label: "青竹", from: "#10b981", to: "#0d9488" },
  { key: "amber", label: "暖阳", from: "#f59e0b", to: "#f97316" },
  { key: "cyan", label: "晴空", from: "#06b6d4", to: "#3b82f6" },
];

/** 自定义色相默认值（近似星紫），与 globals.css --custom-hue 默认一致 */
export const DEFAULT_HUE = 262;

interface AccentCtx {
  accent: AccentKey;
  customHue: number;
  setAccent: (a: AccentPresetKey) => void;
  /** 一经调用即进入 custom 态；hue 值永不清除，预设 ↔ custom 来回切无缝 */
  setCustomHue: (hue: number) => void;
}

const Ctx = createContext<AccentCtx>({
  accent: "violet",
  customHue: DEFAULT_HUE,
  setAccent: () => {},
  setCustomHue: () => {},
});

export const useAccent = () => useContext(Ctx);

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentKey>("violet");
  const [customHue, setCustomHueState] = useState<number>(DEFAULT_HUE);

  useEffect(() => {
    const saved = document.documentElement.dataset.accent as AccentKey | undefined;
    if (saved === "custom" || (saved && ACCENTS.some((a) => a.key === saved)))
      setAccentState(saved);
    try {
      const h = parseFloat(localStorage.getItem("cl-custom-hue") ?? "");
      if (Number.isFinite(h)) setCustomHueState(h);
    } catch {}
  }, []);

  const setAccent = useCallback((a: AccentPresetKey) => {
    setAccentState(a);
    trackEvent("switch_accent", { accent: a });
    document.documentElement.dataset.accent = a;
    try {
      localStorage.setItem("cl-accent", a);
    } catch {}
  }, []);

  const setCustomHue = useCallback((hue: number) => {
    setAccentState("custom");
    setCustomHueState(hue);
    const root = document.documentElement;
    root.dataset.accent = "custom";
    root.style.setProperty("--custom-hue", String(hue));
    try {
      localStorage.setItem("cl-accent", "custom");
      localStorage.setItem("cl-custom-hue", String(hue));
    } catch {}
  }, []);

  return (
    <Ctx.Provider value={{ accent, customHue, setAccent, setCustomHue }}>
      {children}
    </Ctx.Provider>
  );
}
