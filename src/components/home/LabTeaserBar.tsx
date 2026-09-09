import Link from "next/link";
import { Orbit } from "lucide-react";
import { getT } from "@/lib/i18n/server";

/**
 * 首页实验室速览横条：小行星带星数 + 最新一颗留声星，点击直达 /lab。
 * server component（数据由首页服务端查好传入），样式对齐 DailyCheckinCard
 * 的单行横条形态——不占两栏网格位（右栏的天气/小屋保持原有空间）。
 */
export async function LabTeaserBar({
  starCount,
  latest,
}: {
  starCount: number;
  latest: { content: string; createdAt: Date } | null;
}) {
  const { t } = await getT();
  return (
    <Link href="/lab" className="glass-card glass-hover group flex items-center gap-4 px-5 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-br-gradient text-white accent-glow">
        <Orbit className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{t("home.labTeaser", { n: starCount })}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {latest
            ? t("home.labTeaserLatest", { content: latest.content })
            : t("home.labTeaserEmpty")}
        </p>
      </div>
      <span className="glass-button shrink-0 text-xs transition-transform group-hover:translate-x-0.5">
        {t("home.enterLab")} →
      </span>
    </Link>
  );
}
