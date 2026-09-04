"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Sparkles } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { getVisitorId, trackEvent } from "@/lib/track";
import { XP_RULES } from "@/lib/achievements";

/** 今日运势等级（与 i18n key 对应） */
const LUCK_TIERS = ["best", "good", "mid", "bad"] as const;
const LUCK_EMOJI: Record<(typeof LUCK_TIERS)[number], string> = {
  best: "✨",
  good: "🙂",
  mid: "😌",
  bad: "🙃",
};

/** 简单字符串哈希：visitorId + 日期 → 当日固定运势（无需后端存储） */
function dailyHash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h;
}

const todayKey = () => new Date().toISOString().slice(0, 10);
const checkedStorageKey = () => `cl-checked-in-${todayKey()}`;

/**
 * 每日签到 + 今日运势横条：
 * 运势由访客 ID + 日期确定性生成（同一天结果固定）；
 * 签到走 trackEvent("daily_checkin")，服务端 DAILY_CAPS 保证每天只发一次经验。
 */
export function DailyCheckinCard() {
  const t = useT();
  const [checkedIn, setCheckedIn] = useState(false);
  const [visitorId, setVisitorId] = useState("");

  useEffect(() => {
    setVisitorId(getVisitorId());
    setCheckedIn(localStorage.getItem(checkedStorageKey()) === "1");
  }, []);

  const fortune = useMemo(() => {
    const h = dailyHash(`${visitorId}:${todayKey()}`);
    const tier = LUCK_TIERS[h % LUCK_TIERS.length];
    // 宜/忌条目各由一个独立哈希位选取，词表来自语言包（逗号分隔）
    const doItems = t("home.fortuneDoItems").split(",").map((s) => s.trim()).filter(Boolean);
    const dontItems = t("home.fortuneDontItems").split(",").map((s) => s.trim()).filter(Boolean);
    const doItem = doItems.length ? doItems[(h >>> 3) % doItems.length] : "";
    const dontItem = dontItems.length ? dontItems[(h >>> 7) % dontItems.length] : "";
    return { tier, doItem, dontItem };
  }, [visitorId, t]);

  const handleCheckin = () => {
    if (checkedIn) return;
    setCheckedIn(true);
    localStorage.setItem(checkedStorageKey(), "1");
    trackEvent("daily_checkin");
  };

  return (
    <div className="glass-card flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="font-medium">
          {t("home.fortuneLabel")} · {LUCK_EMOJI[fortune.tier]} {t(`home.fortuneLuck.${fortune.tier}`)}
        </span>
        {fortune.doItem && (
          <span className="text-xs text-muted">
            {t("home.fortuneDo")} {fortune.doItem}
          </span>
        )}
        {fortune.dontItem && (
          <span className="text-xs text-muted">
            {t("home.fortuneDont")} {fortune.dontItem}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={handleCheckin}
        disabled={checkedIn}
        className={`glass-button shrink-0 gap-1.5 px-4 py-2 text-xs font-semibold ${
          checkedIn ? "cursor-default opacity-80" : ""
        }`}
      >
        <CalendarCheck className="h-3.5 w-3.5" />
        {checkedIn
          ? t("home.checkedIn", { n: XP_RULES.daily_checkin })
          : t("home.checkin", { n: XP_RULES.daily_checkin })}
      </button>
    </div>
  );
}
