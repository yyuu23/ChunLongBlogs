"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";

const LS_KEY = "cl-immersive";
const CLS = "cl-immersive";

/**
 * 沉浸阅读：切 <html class="cl-immersive"> 由 CSS 隐藏导航/看板娘/粒子等
 * （这些组件是 (site)/layout 的兄弟节点，不在文章页组件树内，拿不到 React state
 *  —— 与项目已有的 cl-night 全局类同一路子）。
 * 偏好存 localStorage，但只在文章页生效：卸载时移除类，免得首页也没了导航。
 */
export function ImmersiveToggle() {
  const t = useT();
  const [on, setOn] = useState(false);

  // 挂载时恢复偏好；离开文章页时务必摘掉类
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(LS_KEY) === "1";
    } catch {}
    if (saved) {
      setOn(true);
      document.documentElement.classList.add(CLS);
    }
    return () => document.documentElement.classList.remove(CLS);
  }, []);

  const apply = useCallback((next: boolean) => {
    setOn(next);
    document.documentElement.classList.toggle(CLS, next);
    try {
      localStorage.setItem(LS_KEY, next ? "1" : "0");
    } catch {}
  }, []);

  // Esc 退出（沉浸态下唯一的键盘出口）
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") apply(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, apply]);

  const label = on ? t("posts.exitImmersive") : t("posts.immersive");

  return (
    <button
      onClick={() => apply(!on)}
      aria-label={label}
      aria-pressed={on}
      title={label}
      /* 沉浸态下 fixed 到右上角：留在正文里的话滚下去就找不到出口了 */
      className={
        on
          ? "glass-button fixed right-4 top-4 z-[80] !rounded-full !p-2.5 md:right-6 md:top-6"
          : "inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs text-muted transition-colors hover:text-accent"
      }
    >
      {on ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-3.5 w-3.5" />}
      {!on && label}
    </button>
  );
}
