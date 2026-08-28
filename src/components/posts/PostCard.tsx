"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Eye, Clock3 } from "lucide-react";
import { LazyImage } from "@/components/effects/Typewriter";
import type { PostListItem } from "@/lib/posts";
import { formatDate } from "@/lib/utils";

/**
 * 文章卡片：3D 倾斜 + 光标眩光（grid 竖版 / list 横版两种形态）
 */
export function PostCard({
  post,
  index = 0,
  variant = "grid",
}: {
  post: PostListItem;
  index?: number;
  variant?: "grid" | "list";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * 6;
    const ry = (px - 0.5) * 6;
    el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    setGlare({ x: px * 100, y: py * 100, opacity: 0.5 });
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
    setGlare((g) => ({ ...g, opacity: 0 }));
  };

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: Math.min(index * 0.07, 0.5), duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/posts/${post.slug}`} className="group block">
        <div
          ref={ref}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          className="glass-card glass-hover relative overflow-hidden transition-transform duration-200"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* 光标眩光层 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
            style={{
              opacity: glare.opacity,
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.35), transparent 60%)`,
            }}
          />

          {variant === "grid" ? (
            <div className="flex flex-col">
              <div className="relative aspect-[16/9] overflow-hidden rounded-t-3xl">
                {post.cover ? (
                  <LazyImage
                    src={post.cover}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-accent-br-gradient opacity-60" />
                )}
                {post.isPinned && (
                  <span className="absolute left-3 top-3 z-10 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2.5 py-0.5 text-xs font-semibold text-white shadow">
                    置顶
                  </span>
                )}
                {post.category && (
                  <span
                    className="absolute bottom-3 left-3 z-10 rounded-full px-2.5 py-0.5 text-xs font-medium text-white shadow"
                    style={{ backgroundColor: `${post.category.color}cc` }}
                  >
                    {post.category.name}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2.5 p-5">
                <h2 className="font-serif text-lg font-bold leading-snug transition-colors group-hover:text-[var(--accent-text)]">
                  {post.title}
                </h2>
                <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
                  {post.description}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(post.publishedAt ?? post.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {post.readingTime} 分钟 · {post.wordCount} 字
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {post.views}
                  </span>
                </div>
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {post.tags.map((t) => (
                      <span
                        key={t.id}
                        className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent"
                      >
                        #{t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-5 sm:flex-row">
              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl sm:aspect-video sm:w-56">
                {post.cover ? (
                  <LazyImage
                    src={post.cover}
                    alt={post.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 224px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-accent-br-gradient opacity-60" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 py-1 pr-2">
                <div className="flex items-center gap-2">
                  {post.isPinned && (
                    <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2 py-0.5 text-[11px] font-semibold text-white">
                      置顶
                    </span>
                  )}
                  {post.category && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ backgroundColor: `${post.category.color}cc` }}
                    >
                      {post.category.name}
                    </span>
                  )}
                </div>
                <h2 className="font-serif text-lg font-bold leading-snug transition-colors group-hover:text-[var(--accent-text)]">
                  {post.title}
                </h2>
                <p className="line-clamp-2 text-sm leading-relaxed text-muted">
                  {post.description}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(post.publishedAt ?? post.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {post.readingTime} 分钟
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {post.views}
                  </span>
                  {post.tags.slice(0, 3).map((t) => (
                    <span key={t.id} className="text-accent">
                      #{t.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
