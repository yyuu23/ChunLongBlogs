import Link from "next/link";
import { BookOpen, UserRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { HeroRotator } from "@/components/home/HeroRotator";

/**
 * 首页文字 Hero：无卡片、无图片轮播，文字直接融于站点背景
 * （Sakurairo/Firefly 式开场）。可读性靠多层深色投影兜底，
 * 不依赖遮罩方向 —— 亮色壁纸下白字+黑影同样成立。
 * 主/副标题由 HeroRotator 多套文案轮播 + AI 流式打字机呈现。
 */
export async function TextHero() {
  const { t } = await getT();
  return (
    <section className="flex flex-col items-center justify-center gap-5 py-16 text-center md:py-24">
      <HeroRotator />
      <div className="mt-2 flex gap-3">
        <Link
          href="/posts"
          className="glass-button border-white/40 bg-white/25 text-white hover:!bg-white/35"
        >
          <BookOpen className="h-4 w-4" />
          {t("home.startReading")}
        </Link>
        <Link
          href="/about"
          className="glass-button border-white/30 bg-white/10 text-white hover:!bg-white/20"
        >
          <UserRound className="h-4 w-4" />
          {t("home.aboutMe")}
        </Link>
      </div>
    </section>
  );
}
