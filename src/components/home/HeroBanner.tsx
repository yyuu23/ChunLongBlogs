"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, UserRound } from "lucide-react";
import { LazyImage, Typewriter } from "@/components/effects/Typewriter";
import type { Banner as BannerType } from "@/lib/site";

/** 首页大图轮播：交叉淡入 + Ken Burns + 打字机副标题 */
export function HeroBanner({ banners }: { banners: BannerType[] }) {
  const slides = banners.length ? banners : [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

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
                sizes="100vw"
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
            开始阅读
          </Link>
          <Link
            href="/about"
            className="glass-button border-white/30 bg-white/10 text-white hover:!bg-white/20"
          >
            <UserRound className="h-4 w-4" />
            关于我
          </Link>
        </div>

        {/* 指示点 */}
        {slides.length > 1 && (
          <div className="absolute bottom-5 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`第 ${i + 1} 张`}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === index ? "w-7 bg-white" : "w-3 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
