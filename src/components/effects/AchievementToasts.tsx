"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { ACHIEVEMENTS, type AchievementDef } from "@/lib/achievements";
import { fetchProgress, type PlayerProgress } from "@/lib/track";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { pick } from "@/lib/i18n/config";
import { tierStyle } from "@/components/lab/AchievementWall";

const SEEN_KEY = "cl-ach-seen";
const TOAST_MS = 5000;
/** 单次事件最多弹几个（防解锁风暴） */
const MAX_PER_EVENT = 3;

interface ToastItem {
  id: number;
  def: AchievementDef;
  tier: string;
}

/**
 * 全局成就解锁 toast。
 *
 * 基线三步（核心是「初始化来源绝不弹」）：
 *  ① 挂载时同步读 localStorage 缓存（先于任何网络返回，防老访客 toast 风暴）
 *  ② GET 静默并入基线（覆盖清了缓存但服务端有历史成就的场景）
 *  ③ 只有 cl-player-update 事件里「基线之外的新成就」才弹
 */
export function AchievementToasts() {
  const { locale } = useLocale();
  const t = useT();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const baseline = useRef<Set<string> | null>(null); // null = 未初始化
  const ready = useRef(false);

  useEffect(() => {
    try {
      baseline.current = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
    } catch {
      baseline.current = new Set();
    }
    if (baseline.current.size > 0) ready.current = true;

    const persist = () => {
      if (!baseline.current) return;
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...baseline.current]));
      } catch {}
    };

    void fetchProgress().then((p) => {
      if (!p || !baseline.current) return;
      p.achievements.forEach((k) => baseline.current!.add(k));
      ready.current = true;
      persist();
    });

    const timers: number[] = [];

    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<PlayerProgress>).detail;
      const base = baseline.current;
      if (!detail || !base) return;
      const fresh = detail.achievements.filter((k) => !base.has(k));
      detail.achievements.forEach((k) => base.add(k));
      persist();
      if (!ready.current || fresh.length === 0) return; // 基线未就绪：静默并入
      const stamp = Date.now();
      fresh
        .map((k) => ACHIEVEMENTS.find((a) => a.key === k))
        .filter((d): d is AchievementDef => Boolean(d))
        .slice(0, MAX_PER_EVENT)
        .forEach((def, i) => {
          const id = stamp + i;
          setToasts((ts) => [...ts, { id, def, tier: detail.tier }]);
          timers.push(
            window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), TOAST_MS),
          );
        });
    };

    window.addEventListener("cl-player-update", onUpdate);
    return () => {
      window.removeEventListener("cl-player-update", onUpdate);
      timers.forEach((id) => clearTimeout(id));
    };
  }, []);

  return (
    // 右上角：右下被 FloatingTools / 音乐条 / MobileTabBar 占满了
    <div className="pointer-events-none fixed right-4 top-20 z-[70] flex w-64 flex-col gap-2 md:right-6 md:w-72">
      <AnimatePresence>
        {toasts.map(({ id, def, tier }) => (
          <motion.div
            key={id}
            layout
            initial={{ opacity: 0, x: 48, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="glass-card pointer-events-auto relative overflow-hidden p-3 pl-4"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={tierStyle(tier)} />
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                {def.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-accent">
                  {t("ach.unlocked")}
                </p>
                <p className="truncate text-sm font-bold">{pick(locale, def.name)}</p>
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
