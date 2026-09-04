"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, UserRound } from "lucide-react";
import { LazyImage, Typewriter } from "@/components/effects/Typewriter";
import { useT } from "@/components/providers/LocaleProvider";
import type { Banner as BannerType } from "@/lib/site";

/** 首页大图轮播：交叉淡入 + Ken Burns + 打字机副标题 */
export function HeroBanner({ banners }: { banners: BannerType[] }) {
  const t = useT();
  const slides = banners.length ? banners : [];
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    if (slides.length < 2) return;
    timerRef.current = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      7000,
    );
  }, [slides.length, stop]);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  /** 手动切换：选中的幻灯片立即显示，并重置自动轮播计时 */
  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      start();
    },
    [start],
  );

  if (!slides.length) return null;
  const current = slides[index];

  return (
    <section className="glass-card relative overflow-hidden">
      {/* 背景幻灯 */}
      <div className="absolute inset-0">
        <AnimatePresence mode="sync">
          <motion.div
            key={index}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          >
            <div className="relative h-full w-full">
              <LazyImage
                src={current.image}
                alt={current.title}
                fill
                priority
                /* 首页容器是 w-[min(96%,72rem)]：≥1200px 视口时卡片恒为 1152px 宽，
                 * 按 100vw 声明会让大屏访客多下 2 倍以上分辨率的大图 */
                sizes="(min-width: 1200px) 1152px, 96vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 文案 */}
      <div className="relative z-10 flex min-h-[22rem] flex-col items-center justify-center gap-4 px-6 py-16 text-center md:min-h-[26rem]">
        <motion.h1
          key={`t-${index}`}
          initial={{ y: 26, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl font-black tracking-wide text-white drop-shadow-lg md:text-5xl"
        >
          {current.title}
        </motion.h1>
        <Typewriter
          key={`s-${index}`}
          text={current.subtitle}
          className="text-sm text-white/90 drop-shadow md:text-lg"
        />
        <div className="mt-4 flex gap-3">
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

        {/* 指示点：固定大小按钮包裹动画条，保证点击热区稳定 */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 flex gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={t("home.bannerAria", { i: i + 1 })}
                className="group flex h-7 w-8 cursor-pointer items-center justify-center"
              >
                <span
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === index ? "w-6 bg-white" : "w-2.5 bg-white/45 group-hover:bg-white/70"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
