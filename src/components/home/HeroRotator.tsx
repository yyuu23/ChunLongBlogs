"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useEffects } from "@/components/providers/EffectProvider";

/**
 * 首页 Hero 文案轮播（AI 流式打字机）：
 * 多套「主标题 + 副标题」逐字打出（随机抖动节奏 + 逐字微淡入 + 主题色渐变光标），
 * 整套停留数秒后模糊淡出（AnimatePresence mode="wait"），下一套从空白重新"生成"。
 *
 * 首帧（SSR + 客户端首次渲染）静态展示第 0 套完整品牌句 —— SEO 无损、无闪烁、
 * hydration 前后一致；挂载后才启动循环。特效开关关闭或 prefers-reduced-motion
 * （EffectProvider 会全量关特效）时保持静态不轮播。
 */

/** 每字延迟（ms）：固定步长 + 随机抖动，模拟流式生成的不规则节奏 */
const TITLE_STEP = 75;
const TITLE_JITTER = 45;
const SUB_STEP = 40;
const SUB_JITTER = 20;
/** 标题打完 → 副标题开始 / 副标题打完 → 进入停留 */
const PAUSE_AFTER_TITLE = 350;
/** 整套停留时长 */
const HOLD_MS = 4000;
/** 退出动画时长（需与下方 exit transition 的 duration 保持一致） */
const EXIT_MS = 420;

type Phase = "idle" | "title" | "sub" | "hold";

interface HeroSet {
  title: string;
  sub: string;
}

export function HeroRotator() {
  const { t, tArr } = useLocale();
  const { effects, hydrated } = useEffects();

  const sets = useMemo<HeroSet[]>(() => {
    const titles = tArr("home.heroTitles");
    // 词典缺数组词条时回退旧单值键（仅一套，不轮播）
    if (titles.length === 1 && titles[0] === "home.heroTitles") {
      return [{ title: t("home.heroSubtitle"), sub: t("home.heroTags") }];
    }
    const subs = tArr("home.heroSubs");
    return titles.map((title, i) => ({ title, sub: subs[i] ?? "" }));
  }, [t, tArr]);

  // 初始 = 静态展示第 0 套完整文案（服务端与客户端首渲染一致）
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [titleN, setTitleN] = useState(() => sets[0]?.title.length ?? 0);
  const [subN, setSubN] = useState(() => sets[0]?.sub.length ?? 0);

  const enabled = hydrated && effects.heroTypewriter && sets.length > 1;

  // 回到静态第 0 套完整文案（品牌句）
  const resetToStatic = useCallback(() => {
    setIdx(0);
    setPhase("idle");
    setTitleN(sets[0]?.title.length ?? 0);
    setSubN(sets[0]?.sub.length ?? 0);
  }, [sets]);

  // 语言切换（sets 引用变化）时重新开始，避免索引错位
  const mountedSets = useRef(sets);
  useEffect(() => {
    if (mountedSets.current === sets) return;
    mountedSets.current = sets;
    resetToStatic();
  }, [sets, resetToStatic]);

  // 特效关闭（含 reduced-motion 全关）时定格静态品牌句，
  // 否则会停在打字半途甚至空文本（关闭瞬间可能正处于新一套的进场空档）
  useEffect(() => {
    if (hydrated && !effects.heroTypewriter) resetToStatic();
  }, [hydrated, effects.heroTypewriter, resetToStatic]);

  // 状态机：idle/hold 到时切套（触发退出动画）→ title 逐字 → sub 逐字 → hold…
  useEffect(() => {
    if (!enabled) return;
    const set = sets[idx % sets.length]!;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (phase === "idle" || phase === "hold") {
      timer = setTimeout(() => {
        setIdx((i) => (i + 1) % sets.length);
        setTitleN(0);
        setSubN(0);
        setPhase("title");
      }, HOLD_MS);
    } else if (phase === "title") {
      timer =
        titleN < set.title.length
          ? setTimeout(
              () => setTitleN((v) => v + 1),
              // 新一套的第一个字先等上一套的退出动画走完
              (titleN === 0 ? EXIT_MS : 0) + TITLE_STEP + Math.random() * TITLE_JITTER,
            )
          : setTimeout(() => setPhase("sub"), PAUSE_AFTER_TITLE);
    } else if (phase === "sub") {
      timer =
        subN < set.sub.length
          ? setTimeout(() => setSubN((v) => v + 1), SUB_STEP + Math.random() * SUB_JITTER)
          : setTimeout(() => setPhase("hold"), PAUSE_AFTER_TITLE);
    }
    return () => clearTimeout(timer);
  }, [enabled, phase, idx, titleN, subN, sets]);

  const set = sets[idx % sets.length]!;
  const showCaret = phase === "title" || phase === "sub" || phase === "hold";

  return (
    <div aria-live="off" className="flex w-full flex-col items-center gap-5">
      <AnimatePresence mode="wait">
        {/* 不设 initial：SSR 首帧直接可见（SEO/无闪烁）；退出动画在切套时由
            AnimatePresence 播放，新一套以空文本进场、靠逐字打出完成"入场" */}
        <motion.div
          key={idx}
          className="flex w-full flex-col items-center gap-5"
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: EXIT_MS / 1000, ease: "easeOut" }}
        >
          <h1 className="whitespace-pre-wrap font-serif text-4xl font-black tracking-wide text-white [text-shadow:0_2px_8px_rgb(0_0_0/0.5),0_4px_24px_rgb(0_0_0/0.35)] md:text-5xl">
            {Array.from(set.title.slice(0, titleN)).map((ch, i) => (
              <span key={i} className="cl-char-in">
                {ch}
              </span>
            ))}
            {showCaret && <Caret />}
          </h1>
          <p className="whitespace-pre-wrap text-sm tracking-[0.3em] text-white/85 [text-shadow:0_1px_6px_rgb(0_0_0/0.5)] md:text-base">
            {Array.from(set.sub.slice(0, subN)).map((ch, i) => (
              <span key={i} className="cl-char-in">
                {ch}
              </span>
            ))}
            {showCaret && <Caret thin />}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** 打字光标：主题色渐变细条，复用全局 caret-blink 闪烁 */
function Caret({ thin = false }: { thin?: boolean }) {
  return (
    <span
      aria-hidden
      className={`ml-1 inline-block translate-y-[0.06em] animate-[caret-blink_1.1s_step-end_infinite] rounded-full bg-gradient-to-b from-[var(--accent-from)] to-[var(--accent-to)] align-baseline ${
        thin ? "h-[0.8em] w-[1.5px]" : "h-[0.95em] w-[2px]"
      }`}
    />
  );
}
