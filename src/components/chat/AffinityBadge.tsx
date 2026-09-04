"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { fetchProgress, type PlayerProgress } from "@/lib/track";
import { AFFINITY_LEVELS, affinityOf } from "@/lib/affinity";
import { pick } from "@/lib/i18n/config";

/**
 * 好感度徽章：❤ + 等级名，聊天面板两入口共用。
 * 挂载后才查进度（首帧 null，无 hydration 不一致），
 * 监听 cl-player-update 事件即时刷新（聊天/摸头/每日首见都会变）。
 */
export function AffinityBadge({ className = "" }: { className?: string }) {
  const t = useT();
  const { locale } = useLocale();
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    const apply = (p: PlayerProgress) =>
      setLevel(affinityOf(p.stats.affinityPoints ?? 0).level);
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

  if (level === null) return null;
  const name = pick(locale, AFFINITY_LEVELS[Math.min(level, AFFINITY_LEVELS.length) - 1]!);

  return (
    <span
      title={t("chat.affinityTitle")}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[0.625rem] font-medium text-rose-500 dark:text-rose-300 ${className}`}
    >
      <Heart className="h-3 w-3 fill-current" />
      {name} · Lv.{level}
    </span>
  );
}
