import Link from "next/link";
import { BookOpen, UserRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";

/**
 * 首页文字 Hero：无卡片、无图片轮播，文字直接融于站点背景
 * （Sakurairo/Firefly 式开场）。可读性靠多层深色投影兜底，
 * 不依赖遮罩方向 —— 亮色壁纸下白字+黑影同样成立。
 */
export async function TextHero() {
  const { t } = await getT();
  return (
    <section className="flex flex-col items-center justify-center gap-5 py-16 text-center md:py-24">
      <h1 className="font-serif text-4xl font-black tracking-wide text-white [text-shadow:0_2px_8px_rgb(0_0_0/0.5),0_4px_24px_rgb(0_0_0/0.35)] md:text-5xl">
        {t("home.heroSubtitle")}
      </h1>
      <p className="text-sm tracking-[0.3em] text-white/85 [text-shadow:0_1px_6px_rgb(0_0_0/0.5)] md:text-base">
        {t("home.heroTags")}
      </p>
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
