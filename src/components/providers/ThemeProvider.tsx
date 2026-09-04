"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { trackEvent } from "@/lib/track";

/** 用户意图三态；theme 是实际生效值（system 按系统偏好解析） */
export type ThemeMode = "light" | "dark" | "system";
type Theme = "light" | "dark";

interface ThemeCtx {
  mode: ThemeMode;
  theme: Theme;
  setMode: (m: ThemeMode) => void;
  /** light → dark → system 循环（移动端一次点击完成常用切换） */
  cycleMode: () => void;
}

const Ctx = createContext<ThemeCtx>({
  mode: "system",
  theme: "dark",
  setMode: () => {},
  cycleMode: () => {},
});

export const useTheme = () => useContext(Ctx);

const resolve = (m: ThemeMode): Theme =>
  m !== "system"
    ? m
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

/** 把解析结果落到 <html>（dark 类 + colorScheme），返回 resolved 值 */
const apply = (m: ThemeMode): Theme => {
  const resolved = resolve(m);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  return resolved;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 初值与 initScript 默认渲染一致（SSR 安全）；挂载后从 localStorage / html 类恢复
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("cl-theme");
    } catch {}
    // 旧值只有显式 light/dark；system / 未设置统一视为跟随系统
    setModeState(saved === "light" || saved === "dark" ? saved : "system");
    // theme 以 initScript 首帧计算结果（html.dark 类）为准
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  // system 态实时跟随系统偏好变化
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(apply("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const write = useCallback((m: ThemeMode) => {
    const resolved = apply(m);
    try {
      localStorage.setItem("cl-theme", m);
    } catch {}
    return resolved;
  }, []);

  const setMode = useCallback(
    (m: ThemeMode) => {
      trackEvent("set_theme_mode", { mode: m });
      setModeState(m);
      setTheme(write(m));
    },
    [write],
  );

  const cycleMode = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode =
        prev === "light" ? "dark" : prev === "dark" ? "system" : "light";
      trackEvent("set_theme_mode", { mode: next });
      setTheme(write(next));
      return next;
    });
  }, [write]);

  return (
    <Ctx.Provider value={{ mode, theme, setMode, cycleMode }}>
      {children}
    </Ctx.Provider>
  );
}
