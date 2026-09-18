"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { fetchProgress, type PlayerProgress } from "@/lib/engagement/track";
import { AFFINITY_LEVELS, affinityOf } from "@/lib/engagement/affinity";
import { pick } from "@/lib/i18n/config";
import { readAffinityCache } from "@/components/effects/AffinityToasts";

/**
 * 好感度徽章：❤ + 等级名 + 迷你进度条（当前分 → 下一档），聊天面板两入口共用。
 * 首帧同步读 cl-aff-cache 消除空白（AffinityToasts 写穿），挂载后网络校正；
 * 监听 cl-player-update 事件即时刷新（聊天/摸头/每日首见都会变）。
 */
export function AffinityBadge({ className = "" }: { className?: string }) {
  const t = useT();
  const { locale } = useLocale();
  const [points, setPoints] = useState<number | null>(() =>
    typeof window === "undefined" ? null : readAffinityCache().points || null,
  );

  useEffect(() => {
    const apply = (p: PlayerProgress) => setPoints(p.stats.affinityPoints ?? 0);
    void fetchProgress().then((p) => {
      if (p) apply(p);
    });
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<PlayerProgress>).detail;
      if (detail) apply(detail);
    };
    window.addEventListener("cl-player-update", onUpdate);
    return () => window.removeEventListener("cl-player-update", onUpdate);
  }, []);

  if (points === null) return null;
  const { level, nextNeed, progress } = affinityOf(points);
  const name = pick(locale, AFFINITY_LEVELS[Math.min(level, AFFINITY_LEVELS.length) - 1]!);

  return (
    <span
      title={t("chat.affinityProgress", { cur: points, next: nextNeed ?? "MAX" })}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[0.625rem] font-medium text-rose-500 dark:text-rose-300 ${className}`}
    >
      <Heart className="h-3 w-3 fill-current" />
      {name} · Lv.{level}
      <span className="ml-0.5 h-1 w-8 overflow-hidden rounded-full bg-rose-500/20" aria-hidden>
        <span
          className="block h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500 transition-[width] duration-500"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </span>
    </span>
  );
}
