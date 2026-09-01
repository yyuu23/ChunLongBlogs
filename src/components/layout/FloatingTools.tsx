"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useEffects,
  PARTICLE_THEMES,
  type ParticleTheme,
} from "@/components/providers/EffectProvider";
import { ACCENTS, useAccent, type AccentKey } from "@/components/providers/AccentProvider";
import { useT } from "@/components/providers/LocaleProvider";

/** 主题色 key → 词典键（配色键名与文案键名不同步，这里做映射） */
const ACCENT_I18N: Record<AccentKey, string> = {
  violet: "accents.violet",
  rose: "accents.sakura",
  emerald: "accents.jade",
  amber: "accents.amber",
  cyan: "accents.sky",
};

/** 返回顶部 + 特效设置面板（右下角悬浮按钮组） */
export function FloatingTools() {
  const [showTop, setShowTop] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const { effects, toggle, particleTheme, setParticleTheme } = useEffects();
  const { accent, setAccent } = useAccent();
  const t = useT();

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3 md:bottom-8 md:right-6">
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="glass-card w-60 p-4"
          >
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted">{t("tools.accentColor")}</p>
            <div className="mb-4 flex justify-between px-0.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAccent(a.key)}
                  title={t(ACCENT_I18N[a.key])}
                  aria-label={t("tools.accentAria", { label: t(ACCENT_I18N[a.key]) })}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                    accent === a.key ? "scale-110" : ""
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${a.from}, ${a.to})`,
                    boxShadow: accent === a.key ? `0 0 0 2px ${a.from}` : undefined,
                  }}
                />
              ))}
            </div>

            <p className="mb-2.5 text-xs font-semibold tracking-widest text-muted">{t("tools.particleTheme")}</p>
            <div className="mb-4 grid grid-cols-3 gap-1.5">
              {PARTICLE_THEMES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setParticleTheme(p.key as ParticleTheme)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] transition-all ${
                    particleTheme === p.key
                      ? "bg-accent-gradient text-white shadow"
                      : "text-muted hover:bg-white/40 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="text-sm leading-none">{p.emoji}</span>
                  {t(`particles.${p.key}`)}
                </button>
              ))}
            </div>
            <p className="mb-2.5 text-xs font-semibold tracking-widest text-muted">{t("tools.effectsPanel")}</p>
            {(
              [
                ["particles", "tools.particleToggle"],
                ["clickBurst", "tools.clickBurst"],
                ["selectionSparkle", "tools.selectionSparkle"],
                ["splash", "tools.splashScreen"],
                ["mascot", "tools.mascotToggle"],
              ] as const
            ).map(([key, labelKey]) => (
              <label key={key} className="flex cursor-pointer items-center justify-between py-1.5 text-sm">
                {t(labelKey)}
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    toggle(key);
                  }}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    effects[key] ? "bg-accent-solid" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      effects[key] ? "left-[1.125rem]" : "left-0.5"
                    }`}
                  />
                </span>
              </label>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label={t("tools.backToTop")}
            className="glass-button !rounded-full !p-3"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <button
        onClick={() => setPanelOpen((v) => !v)}
        aria-label={t("tools.effectsAria")}
        className={`glass-button !rounded-full !p-3 ${panelOpen ? "rotate-90" : ""} transition-transform duration-300`}
      >
        <Settings2 className="h-4 w-4" />
      </button>
    </div>
  );
}
