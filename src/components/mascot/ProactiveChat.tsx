"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useEffects } from "@/components/providers/EffectProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { festivalOf, isYearEndWindow } from "@/lib/festivals";
import { pick } from "@/lib/i18n/config";
import { readAffinityCache } from "@/components/effects/AffinityToasts";
import { useWeather } from "@/lib/weather";
import { readDigest } from "@/lib/chatMemory";
import { getVisitorId } from "@/lib/track";

/**
 * 主动搭话时机检测：读完文章 / 深夜来访 / 页面久留 / 进入实验室与音乐馆。
 * 展示交给看板娘（window "cl-mascot-say" 事件，Mascot 监听后 showBubble）。
 *
 * 台词双层来源：优先 AI 生成（/api/mascot/say，带天气/记忆/好感/页面上下文，
 * 3 秒超时），失败回落静态词典——词典按好感等级分层（Lv2+ 亲昵 / Lv4+ 专属）。
 *
 * 五重闸门把频率压到"偶尔惊喜"而不是打扰：
 * ① 每会话每时机一次（sessionStorage）② 全局冷却 ≥120s ③ 挂载后 15s 静默（避开登场问候）
 * ④ 看板娘开关开启 ⑤ 触发时是桌面端（移动端无看板娘，容器 hidden md:block）
 * 闸门标记先于 AI fetch 写入（防重入），AI 失败静默走词典。
 */
export function ProactiveChat() {
  const pathname = usePathname();
  const { effects, hydrated, isNight } = useEffects();
  const { locale, tArr } = useLocale();
  const { weather } = useWeather(); // 30min 缓存，搭话时带一句天气（AI 生成用）

  useEffect(() => {
    if (hydrated && !effects.mascot) return;
    let disposed = false;
    const mountedAt = Date.now(); // 静默期基准（挂载一次）
    const enteredAt = Date.now(); // 久留计时基准（pathname 变化即重置——本 effect 随之重挂）
    const timers: ReturnType<typeof setTimeout>[] = [];

    /** 好感等级的分层词典：base 通用 + Lv2+ 亲昵 + Lv4+ 专属（tArr 空数组安全） */
    const pickProactiveLines = (kind: string, level: number): string[] => {
      let lines = [...tArr(`mascot.proactive.${kind}`)];
      if (level >= 2) lines = [...lines, ...tArr(`mascot.proactiveClose.${kind}`)];
      if (level >= 4) lines = [...lines, ...tArr(`mascot.proactiveDear.${kind}`)];
      return lines;
    };

    /** 静态词典回落（festival 的词典模板带 {name} 占位符，由调用方传节日名替换） */
    const fallbackSay = (kind: string, nameForTemplate?: string) => {
      const lines = pickProactiveLines(kind, readAffinityCache().level);
      const raw = lines[Math.floor(Math.random() * lines.length)];
      const text = raw ? (nameForTemplate ? raw.replace("{name}", nameForTemplate) : raw) : "";
      if (text) window.dispatchEvent(new CustomEvent("cl-mascot-say", { detail: { text } }));
    };

    /** AI 优先：带天气/记忆/页面上下文请求 /api/mascot/say，3s 超时或失败回落词典 */
    const saySmart = (kind: string, articleTitle?: string, nameForTemplate?: string) => {
      const fallback = () => fallbackSay(kind, nameForTemplate);
      fetch("/api/mascot/say", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          locale,
          page: pathname,
          ...(articleTitle ? { articleTitle } : {}),
          ...(weather ? { weather: { bucket: weather.bucket, temp: weather.temp } } : {}),
          ...(readDigest() ? { memory: readDigest().slice(0, 300) } : {}),
          localHour: new Date().getHours(),
          visitorId: getVisitorId(),
        }),
        signal: AbortSignal.timeout(3000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { text?: string } | null) => {
          const text = typeof d?.text === "string" ? d.text.trim() : "";
          if (text) {
            window.dispatchEvent(new CustomEvent("cl-mascot-say", { detail: { text } }));
          } else {
            fallback();
          }
        })
        .catch(fallback);
    };

    const say = (kind: string, articleTitle?: string, nameForTemplate?: string) => {
      if (disposed) return;
      try {
        if (sessionStorage.getItem(`cl-said:${kind}`)) return;
        const lastAt = Number(sessionStorage.getItem("cl-proactive-at")) || 0;
        if (Date.now() - lastAt < 120_000) return;
        if (Date.now() - mountedAt < 15_000) return;
        if (!matchMedia("(min-width: 768px)").matches) return;
        // 标记先于 fetch：AI 请求期间再次触发不重入
        sessionStorage.setItem(`cl-said:${kind}`, "1");
        sessionStorage.setItem("cl-proactive-at", String(Date.now()));
        saySmart(kind, articleTitle, nameForTemplate);
      } catch {}
    };

    /** 原始文本通道已并入 saySmart（festival 场景服务端自查节日名，AI 失败回落带 {name} 模板的词典） */

    // ① 读完文章：详情页滚动进度 ≥92% 且停留 ≥20s（口径同 ReadingProgress，不改它）
    let onScroll: (() => void) | null = null;
    if (/^\/posts\/[^/]+$/.test(pathname)) {
      onScroll = () => {
        const doc = document.documentElement;
        const total = doc.scrollHeight - window.innerHeight;
        const p = total > 0 ? window.scrollY / total : 1;
        if (p >= 0.92 && Date.now() - enteredAt >= 20_000) {
          say("postRead", document.title.split(" - ")[0].slice(0, 60));
          if (onScroll) window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    // ② 深夜来访：停留 10s（静默期保证与登场 nightGreeting 错开）
    if (isNight) {
      timers.push(setTimeout(() => say("night"), 10_000));
    }

    // ③ 页面久留：本页停留满 5 分钟
    const lingerTimer = setInterval(() => {
      if (Date.now() - enteredAt >= 5 * 60_000) {
        say("linger");
        clearInterval(lingerTimer);
      }
    }, 15_000);

    // ④ 进入特定页：稍等 4s 再开口（刚切过来就说太急）
    if (pathname === "/lab") timers.push(setTimeout(() => say("lab"), 4_000));
    if (pathname === "/music") timers.push(setTimeout(() => say("music"), 4_000));

    // ⑤ 节日问候 / 年末开瓶夜预告：当天命中 18s 后说一句（静默期之后；每会话一次；节日优先）
    //    festival 走 AI（服务端自查节日名注入场景）；词典回落时用本地化的节日名替换 {name}
    const fest = festivalOf(new Date());
    if (fest) {
      const festName = pick(locale, fest.name);
      timers.push(setTimeout(() => say("festival", undefined, festName), 18_000));
    } else if (isYearEndWindow()) {
      timers.push(setTimeout(() => say("yearEnd"), 18_000));
    }

    return () => {
      disposed = true;
      if (onScroll) window.removeEventListener("scroll", onScroll);
      timers.forEach(clearTimeout);
      clearInterval(lingerTimer);
    };
    // tArr 进 deps：切语言后台词取新词典（副作用是 effect 重挂、久留计时重置，无害）
  }, [pathname, hydrated, effects.mascot, isNight, tArr, locale, weather]);

  return null;
}
