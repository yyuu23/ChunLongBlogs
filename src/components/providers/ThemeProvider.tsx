"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });

export const useTheme = () => useContext(Ctx);

/** 首帧内联脚本：按 localStorage/系统偏好设置 .dark，避免闪烁（在 layout.tsx 中注入） */
export const themeInitScript = `
(function(){try{
  var t = localStorage.getItem('cl-theme');
  if(!t){ t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
  if(t === 'dark'){ document.documentElement.classList.add('dark'); }
  document.documentElement.style.colorScheme = t;
}catch(e){}})();
`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(current);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      try {
        localStorage.setItem("cl-theme", next);
      } catch {}
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}
