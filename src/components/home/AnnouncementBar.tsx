import { Megaphone } from "lucide-react";
import { currentSolarTerm, seasonOf } from "@/lib/solar-terms";
import { festivalOf, isYearEndWindow } from "@/lib/festivals";
import { pick, DATE_LOCALE } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/server";

/** 公告栏：自动节气 + 节日/年末开瓶夜高亮 + 可选自定义公告（语言随 cookie） */
export async function AnnouncementBar({ customText }: { customText?: string }) {
  const { locale, t } = await getT();
  const now = new Date();
  const term = currentSolarTerm(now);
  const season = seasonOf(now, locale);
  // festivalOf：仅"今天恰好是节气/农历节日"才命中（发瓶同款判定），
  // 与上面"当前所处节气"（几乎总有值）互补
  const fest = festivalOf(now);
  const yearEnd = isYearEndWindow(now);
  const dateText = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <div className="glass-card flex items-center gap-3 px-5 py-3.5 text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white">
        <Megaphone className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
        {fest ? (
          <span className="font-medium text-accent">
            {fest.emoji} {t("home.festivalToday", { name: pick(locale, fest.name) })}
          </span>
        ) : yearEnd ? (
          <span className="font-medium text-accent">{t("home.yearEndLine")}</span>
        ) : null}
        <span className="font-medium">
          {t("home.today")} · {pick(locale, term.name)}
          {locale === "zh" ? "" : ` · ${term.name.en}`}
        </span>
        <span className="text-xs text-muted">
          {dateText} · {season.name} {season.emoji}
        </span>
        {customText && (
          <span className="w-full truncate text-muted" title={customText}>
            📢 {customText}
          </span>
        )}
      </div>
    </div>
  );
}
