"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useEffects } from "@/components/providers/EffectProvider";
import { useLocale } from "@/components/providers/LocaleProvider";

/**
 * 主动搭话时机检测：读完文章 / 深夜来访 / 页面久留 / 进入实验室与音乐馆。
 * 只管时机，展示交给看板娘（window "cl-mascot-say" 事件，Mascot 监听后 showBubble）。
 * 零 AI 成本、零埋点（trackEvent 有 XpEvent 类型门禁，且不需要）。
 *
 * 五重闸门把频率压到"偶尔惊喜"而不是打扰：
 * ① 每会话每时机一次（sessionStorage）② 全局冷却 ≥120s ③ 挂载后 15s 静默（避开登场问候）
 * ④ 看板娘开关开启 ⑤ 触发时是桌面端（移动端无看板娘，容器 hidden md:block）
 */
export function ProactiveChat() {
  const pathname = usePathname();
  const { effects, hydrated, isNight } = useEffects();
  const { tArr } = useLocale();

  useEffect(() => {
    if (hydrated && !effects.mascot) return;
    let disposed = false;
    const mountedAt = Date.now(); // 静默期基准（挂载一次）
    const enteredAt = Date.now(); // 久留计时基准（pathname 变化即重置——本 effect 随之重挂）
    const timers: ReturnType<typeof setTimeout>[] = [];

    const say = (kind: string, i18nKey: string) => {
      if (disposed) return;
      try {
        if (sessionStorage.getItem(`cl-said:${kind}`)) return;
        const lastAt = Number(sessionStorage.getItem("cl-proactive-at")) || 0;
        if (Date.now() - lastAt < 120_000) return;
        if (Date.now() - mountedAt < 15_000) return;
        if (!matchMedia("(min-width: 768px)").matches) return;
        const lines = tArr(i18nKey);
        const text = lines[Math.floor(Math.random() * lines.length)];
        if (!text) return;
        sessionStorage.setItem(`cl-said:${kind}`, "1");
        sessionStorage.setItem("cl-proactive-at", String(Date.now()));
        window.dispatchEvent(new CustomEvent("cl-mascot-say", { detail: { text } }));
      } catch {}
    };

    // ① 读完文章：详情页滚动进度 ≥92% 且停留 ≥20s（口径同 ReadingProgress，不改它）
    let onScroll: (() => void) | null = null;
    if (/^\/posts\/[^/]+$/.test(pathname)) {
      onScroll = () => {
        const doc = document.documentElement;
        const total = doc.scrollHeight - window.innerHeight;
        const p = total > 0 ? window.scrollY / total : 1;
        if (p >= 0.92 && Date.now() - enteredAt >= 20_000) {
          say("postRead", "mascot.proactive.postRead");
          if (onScroll) window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    // ② 深夜来访：停留 10s（静默期保证与登场 nightGreeting 错开）
    if (isNight) {
      timers.push(setTimeout(() => say("night", "mascot.proactive.night"), 10_000));
    }

    // ③ 页面久留：本页停留满 5 分钟
    const lingerTimer = setInterval(() => {
      if (Date.now() - enteredAt >= 5 * 60_000) {
        say("linger", "mascot.proactive.linger");
        clearInterval(lingerTimer);
      }
    }, 15_000);

    // ④ 进入特定页：稍等 4s 再开口（刚切过来就说太急）
    if (pathname === "/lab") timers.push(setTimeout(() => say("lab", "mascot.proactive.lab"), 4_000));
    if (pathname === "/music") timers.push(setTimeout(() => say("music", "mascot.proactive.music"), 4_000));

    return () => {
      disposed = true;
      if (onScroll) window.removeEventListener("scroll", onScroll);
      timers.forEach(clearTimeout);
      clearInterval(lingerTimer);
    };
    // tArr 进 deps：切语言后台词取新词典（副作用是 effect 重挂、久留计时重置，无害）
  }, [pathname, hydrated, effects.mascot, isNight, tArr]);

  return null;
}
