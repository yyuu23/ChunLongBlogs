"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useEffects,
  PARTICLE_THEMES,
  type ParticleTheme,
} from "@/components/providers/EffectProvider";
import { ACCENTS, useAccent } from "@/components/providers/AccentProvider";

/** 返回顶部 + 特效设置面板（右下角悬浮按钮组） */
export function FloatingTools() {
  const [showTop, setShowTop] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const { effects, toggle, particleTheme, setParticleTheme } = useEffects();
  const { accent, setAccent } = useAccent();

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
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted">主题色</p>
            <div className="mb-4 flex justify-between px-0.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAccent(a.key)}
                  title={a.label}
                  aria-label={`主题色：${a.label}`}
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

            <p className="mb-2.5 text-xs font-semibold tracking-widest text-muted">粒子主题</p>
            <div className="mb-4 grid grid-cols-3 gap-1.5">
              {PARTICLE_THEMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setParticleTheme(t.key as ParticleTheme)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] transition-all ${
                    particleTheme === t.key
                      ? "bg-accent-gradient text-white shadow"
                      : "text-muted hover:bg-white/40 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="text-sm leading-none">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mb-2.5 text-xs font-semibold tracking-widest text-muted">特效开关</p>
            {(
              [
                ["particles", "主题粒子"],
                ["clickBurst", "点击爆破"],
                ["selectionSparkle", "选中星光"],
                ["splash", "启动屏"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center justify-between py-1.5 text-sm">
                {label}
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
            aria-label="返回顶部"
            className="glass-button !rounded-full !p-3"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <button
        onClick={() => setPanelOpen((v) => !v)}
        aria-label="特效设置"
        className={`glass-button !rounded-full !p-3 ${panelOpen ? "rotate-90" : ""} transition-transform duration-300`}
      >
        <Settings2 className="h-4 w-4" />
      </button>
    </div>
  );
}
