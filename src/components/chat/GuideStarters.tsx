"use client";

import { useEffect, useState } from "react";
import { Compass, Save, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import {
  clearGuidePreferences,
  readGuidePreferences,
  saveGuidePreferences,
} from "@/lib/chat/guide-preferences";
import type { GuidePreferences } from "@/lib/content/types";

const STARTER_COUNT = 3;
const SEED_KEY = "cl-guide-starter-seed";

/** mulberry32：同一颗种子给出同一串随机数 */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 从问题池里随机抽 3 条。种子存在 sessionStorage：同一会话内 /chat 页与悬浮窗
 * 展示同一批（种子相同、洗牌确定），刷新页面换一批；sessionStorage 不可用时退化为固定取前 3。
 */
function pickStarters(pool: string[]): string[] {
  if (pool.length <= STARTER_COUNT) return pool;
  let seed = 42;
  try {
    const existing = sessionStorage.getItem(SEED_KEY);
    if (existing && Number.isFinite(Number(existing))) {
      seed = Number(existing);
    } else {
      seed = Math.floor(Math.random() * 0xffffffff);
      sessionStorage.setItem(SEED_KEY, String(seed));
    }
  } catch {
    // 隐私模式等场景下 sessionStorage 可能被禁用，保持固定种子即可
  }
  const rand = mulberry32(seed);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, STARTER_COUNT);
}

export function GuideStarters({
  compact = false,
  onSelect,
}: {
  compact?: boolean;
  onSelect: (question: string) => void;
}) {
  const t = useT();
  const { tArr } = useLocale();
  const questions = pickStarters(tArr("chatPage.guideStarters"));
  const [saved, setSaved] = useState<GuidePreferences | null>(null);
  const [interests, setInterests] = useState("");
  const [level, setLevel] = useState<GuidePreferences["level"]>();
  const [goal, setGoal] = useState("");

  useEffect(() => {
    const value = readGuidePreferences();
    setSaved(value);
    setInterests(value?.interests.join("、") ?? "");
    setLevel(value?.level);
    setGoal(value?.goal ?? "");
  }, []);

  return (
    <section className={compact ? "space-y-1.5" : "space-y-3"} aria-label={t("chatPage.guideTitle")}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Compass className="h-3.5 w-3.5 text-accent" />
        {t("chatPage.guideTitle")}
      </p>
      <div className={compact ? "grid gap-1.5" : "flex flex-wrap gap-2"}>
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onSelect(question)}
            className={`glass-button text-left text-muted transition-colors hover:text-accent ${
              compact ? "!rounded-xl !px-2.5 !py-1.5 text-[0.6875rem]" : "!rounded-full !px-3.5 !py-1.5 text-xs"
            }`}
          >
            {question}
          </button>
        ))}
      </div>
      <p className="text-[0.625rem] leading-relaxed text-muted">{t("chatPage.guidePrefillHint")}</p>

      {!compact && (
        <details className="glass-card !rounded-xl p-3 text-xs">
          <summary className="cursor-pointer font-medium text-muted hover:text-accent">
            {saved ? t("chatPage.preferencesSaved") : t("chatPage.preferencesTitle")}
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={interests}
              onChange={(event) => setInterests(event.target.value)}
              placeholder={t("chatPage.preferencesInterests")}
              className="glass-input text-xs"
            />
            <select
              value={level ?? ""}
              onChange={(event) => setLevel((event.target.value || undefined) as GuidePreferences["level"])}
              className="glass-input text-xs"
            >
              <option value="">{t("chatPage.preferencesLevel")}</option>
              <option value="beginner">{t("difficulty.beginner")}</option>
              <option value="intermediate">{t("difficulty.intermediate")}</option>
              <option value="advanced">{t("difficulty.advanced")}</option>
            </select>
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder={t("chatPage.preferencesGoal")}
              className="glass-input text-xs"
            />
          </div>
          <p className="mt-2 text-[0.625rem] text-muted">{t("chatPage.preferencesPrivacy")}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const value = saveGuidePreferences({
                  interests: interests.split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
                  level,
                  goal: goal.trim() || undefined,
                });
                setSaved(value);
              }}
              className="glass-button flex items-center gap-1 !rounded-lg !px-2.5 !py-1 text-[0.6875rem]"
            >
              <Save className="h-3 w-3" /> {t("chatPage.preferencesSave")}
            </button>
            {saved && (
              <button
                type="button"
                onClick={() => {
                  clearGuidePreferences();
                  setSaved(null);
                  setInterests("");
                  setLevel(undefined);
                  setGoal("");
                }}
                className="glass-button flex items-center gap-1 !rounded-lg !px-2.5 !py-1 text-[0.6875rem] hover:text-rose-500"
              >
                <Trash2 className="h-3 w-3" /> {t("chatPage.preferencesClear")}
              </button>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
