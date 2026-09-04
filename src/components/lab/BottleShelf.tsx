"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Wine, X } from "lucide-react";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { getVisitorId } from "@/lib/track";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { festivalByKey } from "@/lib/festivals";
import { DATE_LOCALE, pick } from "@/lib/i18n/config";

/** /api/bottles 行结构 */
interface BottleRow {
  id: number;
  kind: "star" | "achievement" | "festival";
  refKey: string;
  title: string;
  theme: string;
  createdAt: number;
}

const PER_ROW = 8;

/**
 * 漂流瓶架：留星 / 解锁成就 / 节气节日来访 的封存纪念。
 * 瓶内液体颜色和漂浮物由获得时的粒子主题决定 —— 春天的瓶里永远封着樱花。
 * 交互：点击拿起（故事卡）、按住晃动（液体摇晃冒泡）。
 * 懒加载：进入视口才请求；留星成功会收到 cl-bottle-refresh 事件重拉。
 */
export function BottleShelf() {
  const t = useT();
  const { locale } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  /** null = 未加载（首帧壳，hydration 恒定）；[] = 已加载但为空 */
  const [bottles, setBottles] = useState<BottleRow[] | null>(null);
  const [picked, setPicked] = useState<BottleRow | null>(null);

  const load = useCallback(() => {
    fetch(`/api/bottles?visitorId=${encodeURIComponent(getVisitorId())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { bottles?: BottleRow[] } | null) => setBottles(d?.bottles ?? []))
      .catch(() => setBottles([]));
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started) {
          started = true;
          io.disconnect();
          load();
        }
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    const onRefresh = () => load();
    window.addEventListener("cl-bottle-refresh", onRefresh);
    return () => {
      io.disconnect();
      window.removeEventListener("cl-bottle-refresh", onRefresh);
    };
  }, [load]);

  /** 瓶子的展示名：留星用摘录、成就/节日按 refKey 反查（客户端解析，存库只有 key） */
  const nameOf = (b: BottleRow) => {
    if (b.kind === "star") return b.title ? `“${b.title}”` : t("lab.bottleStar");
    if (b.kind === "achievement") {
      const a = ACHIEVEMENTS.find((x) => x.key === b.refKey);
      return a ? `${a.emoji} ${pick(locale, a.name)}` : t("lab.bottleAchievement");
    }
    const f = festivalByKey(b.refKey);
    return f ? `${f.emoji} ${pick(locale, f.name)}` : t("lab.bottleFestival");
  };

  const kindLabel = (b: BottleRow) =>
    b.kind === "star" ? t("lab.bottleStar") : b.kind === "achievement" ? t("lab.bottleAchievement") : t("lab.bottleFestival");

  // 架子从旧到新排（左旧右新 = 一条时间线），每层 PER_ROW 只
  const rows: BottleRow[][] = [];
  const ordered = [...(bottles ?? [])].reverse();
  for (let i = 0; i < ordered.length; i += PER_ROW) rows.push(ordered.slice(i, i + PER_ROW));

  return (
    <div ref={rootRef} className="glass-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Wine className="h-4 w-4 text-accent" />
        <p className="text-sm font-semibold">{t("lab.shelfTitle")}</p>
        {bottles && bottles.length > 0 && (
          <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-muted">{bottles.length}</span>
        )}
      </div>
      <p className="mb-4 text-xs text-muted">{t("lab.shelfHint")}</p>

      {bottles === null && (
        <p className="py-6 text-center text-xs text-muted/60">{t("lab.shelfLoading")}</p>
      )}

      {bottles?.length === 0 && (
        <p className="py-6 text-center text-xs text-muted">{t("lab.shelfEmpty")}</p>
      )}

      {rows.map((row, ri) => (
        <div key={ri} className="relative">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1 px-2">
            {row.map((b) => (
              <Bottle key={b.id} b={b} name={nameOf(b)} onPick={() => setPicked(b)} />
            ))}
            {/* 最后一层不满时补空位，让瓶子都"立在架上" */}
            {ri === rows.length - 1 &&
              Array.from({ length: (PER_ROW - row.length) % PER_ROW }).map((_, i) => <span key={i} className="w-[34px]" />)}
          </div>
          {/* 木板 */}
          <div className="shelf-board" aria-hidden />
        </div>
      ))}

      {/* 故事卡：拿起端详 */}
      <AnimatePresence>
        {picked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            onClick={() => setPicked(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="glass-card relative w-[min(22rem,92vw)] !rounded-3xl p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPicked(null)}
                aria-label="close"
                className="absolute right-3 top-3 rounded-full p-1 text-muted hover:text-rose-400"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto my-2 w-fit scale-[2.1] py-4">
                <BottleGraphic theme={picked.theme} />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] text-muted">
                {kindLabel(picked)}
              </span>
              <p className="mt-2 font-serif text-lg font-bold">{nameOf(picked)}</p>
              <p className="mt-1 text-xs text-muted">
                {t("lab.bottleSealedAt", { date: new Date(picked.createdAt).toLocaleDateString(DATE_LOCALE[locale]) })}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 纯 CSS 瓶子（故事卡里放大展示用,与架子上的交互瓶共用图形） */
function BottleGraphic({ theme }: { theme: string }) {
  return (
    <span className="bottle" data-theme={theme}>
      <span className="bottle-cork" />
      <span className="bottle-glass">
        <span className="bottle-liquid">
          <span className="bottle-float" />
          <span className="bottle-float f2" />
        </span>
        <span className="bottle-shine" />
      </span>
    </span>
  );
}

/** 架子上的交互瓶:点击拿起,按住晃动会让液体摇晃冒泡 */
function Bottle({ b, name, onPick }: { b: BottleRow; name: string; onPick: () => void }) {
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acc = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    acc.current = 0;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!last.current) return;
    acc.current += Math.abs(e.clientX - last.current.x) + Math.abs(e.clientY - last.current.y);
    last.current = { x: e.clientX, y: e.clientY };
    if (acc.current > 36) {
      // 摇起来啦
      if (!shaking) setShaking(true);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShaking(false), 1200);
    }
  };
  const onPointerUp = () => {
    const wasStill = last.current !== null && acc.current <= 10; // 原地点击 = 拿起端详
    last.current = null;
    if (wasStill) onPick();
  };

  return (
    <button
      title={name}
      aria-label={name}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => (last.current = null)}
      className="relative cursor-grab touch-none select-none transition-transform duration-200 hover:-translate-y-1 active:cursor-grabbing"
    >
      <span className={shaking ? "bottle is-shaking" : "bottle"} data-theme={b.theme}>
        <span className="bottle-cork" />
        <span className="bottle-glass">
          <span className="bottle-liquid">
            <span className="bottle-float" />
            <span className="bottle-float f2" />
            {shaking && (
              <>
                <span className="bottle-bub" style={{ left: "30%", animationDelay: "0s" }} />
                <span className="bottle-bub" style={{ left: "55%", animationDelay: "0.25s" }} />
                <span className="bottle-bub" style={{ left: "44%", animationDelay: "0.5s" }} />
              </>
            )}
          </span>
          <span className="bottle-shine" />
        </span>
      </span>
    </button>
  );
}
