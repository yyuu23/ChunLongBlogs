"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Lock, Sparkles } from "lucide-react";
import {
  ACHIEVEMENTS,
  CATEGORY_META,
  achievementProgress,
  type AchievementCategory,
  type AchievementDef,
} from "@/lib/achievements";
import type { PlayerProgress } from "@/lib/track";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { pick, type Locale } from "@/lib/i18n/config";

/** 组的展示顺序（与成就定义文件一致） */
const GROUP_ORDER: AchievementCategory[] = ["basic", "reading", "music", "explore", "social", "legend"];
/** 记忆用户展开/收起了哪些组 */
const OPEN_KEY = "cl-ach-open";

/** 徽章底色随玩家 tier 升级（金/银/铜），成就 toast 也复用 */
export function tierStyle(tier: string) {
  if (tier === "gold") return { background: "linear-gradient(135deg,#fbbf24,#f97316)", color: "#fff" };
  if (tier === "silver") return { background: "linear-gradient(135deg,#cbd5e1,#94a3b8)", color: "#fff" };
  return { background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff" };
}

export function AchievementWall({ progress }: { progress: PlayerProgress | null }) {
  const { locale } = useLocale();
  const t = useT();
  // 初始全收起（常量，SSR 安全）；挂载后再从 localStorage 恢复上次的选择
  const [open, setOpen] = useState<Record<AchievementCategory, boolean>>({
    basic: false,
    reading: false,
    music: false,
    explore: false,
    social: false,
    legend: false,
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Partial<
        Record<AchievementCategory, boolean>
      >;
      setOpen((prev) => ({ ...prev, ...saved }));
    } catch {}
  }, []);

  const toggle = (cat: AchievementCategory) => {
    setOpen((prev) => {
      const next = { ...prev, [cat]: !prev[cat] };
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const unlockedSet = useMemo(() => new Set(progress?.achievements ?? []), [progress]);
  const stats = progress?.stats;

  return (
    <div className="glass-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
          <Sparkles className="h-4 w-4 text-accent" /> {t("lab.badges")}
        </h2>
        {progress && (
          <span className="text-xs text-muted">
            {t("lab.unlocked", { n: progress.achievements.length, m: ACHIEVEMENTS.length })}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {GROUP_ORDER.map((cat) => {
          const defs = ACHIEVEMENTS.filter((a) => a.category === cat);
          const meta = CATEGORY_META[cat];
          const n = defs.filter((d) => unlockedSet.has(d.key)).length;
          return (
            <section key={cat}>
              <button
                type="button"
                onClick={() => toggle(cat)}
                aria-expanded={open[cat]}
                title={pick(locale, meta.hint)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span aria-hidden>{meta.emoji}</span>
                <span className="text-sm font-bold">{pick(locale, meta.name)}</span>
                {progress && (
                  <span className="ml-auto text-xs tabular-nums text-muted">
                    {t("lab.unlocked", { n, m: defs.length })}
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted transition-transform duration-300 ${
                    open[cat] ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {open[cat] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
                      {defs.map((a, i) => (
                        <BadgeCell
                          key={a.key}
                          def={a}
                          index={i}
                          unlocked={unlockedSet.has(a.key)}
                          tier={progress?.tier ?? "bronze"}
                          progress={achievementProgress(a, stats)}
                          locale={locale}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted">{t("lab.badgeWallHint")}</p>
    </div>
  );
}

function BadgeCell({
  def,
  index,
  unlocked,
  tier,
  progress,
  locale,
}: {
  def: AchievementDef;
  index: number;
  unlocked: boolean;
  tier: string;
  progress: { current: number; target: number } | null;
  locale: Locale;
}) {
  const name = pick(locale, def.name);
  const desc = pick(locale, def.description);
  const pct = progress ? Math.round((progress.current / progress.target) * 100) : 0;
  // hover 原生提示里带上进度（未解锁且有数据时）
  const title = progress && !unlocked ? `${name}：${desc}（${progress.current}/${progress.target}）` : `${name}：${desc}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      // 解锁徽章 hover 上浮（外层 transform）；emoji 的摇摆在 CSS 里做，两层互不干扰
      whileHover={unlocked ? { scale: 1.12, y: -4 } : undefined}
      whileTap={{ scale: 0.95 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 400, damping: 20 }}
      title={title}
      className={`ach-badge flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition-opacity ${
        unlocked
          ? "bg-accent-soft hover:drop-shadow-[0_8px_12px_rgba(250,204,21,0.35)]"
          : "opacity-45 hover:opacity-60"
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center text-xl ${
          unlocked ? "hex-badge ach-emoji" : "ach-lock"
        }`}
        style={unlocked ? tierStyle(tier) : undefined}
      >
        {unlocked ? def.emoji : <Lock className="h-4 w-4 text-muted" />}
      </span>
      <span className="text-[11px] font-medium leading-tight">{name}</span>
      {unlocked ? (
        <span className="hidden text-[10px] leading-tight text-muted sm:block">{desc}</span>
      ) : (
        // 未解锁：描述换成微型进度条（只在有点进度时渲染，避免满屏 0/1000）
        progress &&
        progress.current > 0 && (
          <div className="flex w-full items-center gap-1" aria-hidden>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-accent-gradient transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted">
              {progress.current}/{progress.target}
            </span>
          </div>
        )
      )}
    </motion.div>
  );
}
