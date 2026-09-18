"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Heart } from "lucide-react";
import { fetchProgress, type PlayerProgress } from "@/lib/engagement/track";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { AFFINITY_LEVELS, affinityOf } from "@/lib/engagement/affinity";
import { pick } from "@/lib/i18n/config";

const SEEN_KEY = "cl-aff-seen"; // 上次已知等级（number）
const CACHE_KEY = "cl-aff-cache"; // { level, points }：徽章/搭话的免请求缓存
const TOAST_MS = 5000;

interface ToastItem {
  id: number;
  level: number;
}

/** 好感等级缓存的读写（ProactiveChat 分层词典、AI 搭话与徽章首帧共用） */
export function readAffinityCache(): { level: number; points: number } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { level?: number; points?: number };
      if (typeof parsed.level === "number" && typeof parsed.points === "number") {
        return { level: parsed.level, points: parsed.points };
      }
    }
  } catch {}
  return { level: 1, points: 0 };
}

function writeAffinityCache(level: number, points: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ level, points, updatedAt: Date.now() }));
  } catch {}
}

/**
 * 好感度升级 toast（与成就 toast 同区右上角，样式仿骨架）。
 * 基线三步同 AchievementToasts：localStorage 基线 → GET 静默并入 →
 * 仅 cl-player-update 事件里的「升级」才弹。升级同时派发看板娘庆祝
 * （shake 动作 + f02 表情 + 随机专属台词），并写穿等级缓存。
 */
export function AffinityToasts() {
  const { locale, tArr } = useLocale();
  const t = useT();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const baseline = useRef<number | null>(null); // null = 未初始化
  const ready = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(SEEN_KEY));
    baseline.current = Number.isFinite(saved) && saved > 0 ? saved : null;
    if (baseline.current != null) {
      ready.current = true;
      writeAffinityCache(baseline.current, 0);
    }

    const persist = (level: number) => {
      baseline.current = level;
      try {
        localStorage.setItem(SEEN_KEY, String(level));
      } catch {}
    };

    void fetchProgress().then((p) => {
      if (!p) return;
      const level = affinityOf(p.stats.affinityPoints ?? 0).level;
      writeAffinityCache(level, p.stats.affinityPoints ?? 0);
      if (baseline.current == null) {
        persist(level); // 首次：静默并入，不弹
      }
      ready.current = true;
    });

    const timers: number[] = [];
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<PlayerProgress>).detail;
      if (!detail) return;
      const points = detail.stats.affinityPoints ?? 0;
      const level = affinityOf(points).level;
      writeAffinityCache(level, points);
      const base = baseline.current;
      if (base == null) {
        persist(level); // 基线未就绪：静默并入
        return;
      }
      if (level <= base) {
        if (level < base) persist(level); // 不会发生（好感只涨），防御性同步
        return;
      }
      persist(level);
      if (!ready.current) return;
      const id = Date.now();
      setToasts((ts) => [...ts, { id, level }]);
      timers.push(window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), TOAST_MS));
      // 看板娘庆祝：升级台词 + 摇晃动作 + 害羞表情
      const lines = tArr("mascot.affinityUp.lines");
      const line = lines[Math.floor(Math.random() * lines.length)];
      if (line) {
        window.dispatchEvent(
          new CustomEvent("cl-mascot-say", {
            detail: { text: `${line} ${pick(locale, AFFINITY_LEVELS[level - 1]!)}`, motion: "shake", expression: "f02" },
          }),
        );
      }
    };

    window.addEventListener("cl-player-update", onUpdate);
    return () => {
      window.removeEventListener("cl-player-update", onUpdate);
      timers.forEach((id) => clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    /* top-40：与成就 toast（top-20）同屏时往下错开一列，升级+解锁撞车也不互相盖 */
    <div className="pointer-events-none fixed right-4 top-40 z-[70] flex w-64 flex-col gap-2 md:right-6 md:w-72">
      <AnimatePresence>
        {toasts.map(({ id, level }) => (
          <motion.div
            key={id}
            layout
            initial={{ opacity: 0, x: 48, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="glass-card pointer-events-auto relative overflow-hidden p-3 pl-4"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-400 to-pink-500"
            />
            <div className="flex items-center gap-3">
              <span className="text-2xl text-rose-500" aria-hidden>
                <Heart className="h-6 w-6 fill-current" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-rose-500">
                  {t("mascot.affinityUp.title")}
                </p>
                <p className="truncate text-sm font-bold">
                  {pick(locale, AFFINITY_LEVELS[level - 1]!)} · Lv.{level}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== id))}
              aria-label={t("ach.close")}
              className="absolute right-1.5 top-1.5 rounded-full p-1 text-muted transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
