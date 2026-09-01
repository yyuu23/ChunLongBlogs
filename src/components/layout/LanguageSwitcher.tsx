"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Languages } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";

/** 导航栏语言切换器：地球图标 + 四语下拉 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("nav.changeLanguage")}
        aria-expanded={open}
        className="glass-button !rounded-full !p-2.5"
      >
        <Languages className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="glass-card absolute right-0 top-11 z-50 min-w-32 rounded-2xl p-1.5"
          >
            {LOCALES.map((l) => (
              <button
                key={l}
                lang={l}
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-1.5 text-sm ${
                  l === locale
                    ? "bg-accent-gradient text-white"
                    : "text-muted hover:bg-white/30 dark:hover:bg-white/5"
                }`}
              >
                <span>{LOCALE_NAMES[l]}</span>
                {l === locale && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
