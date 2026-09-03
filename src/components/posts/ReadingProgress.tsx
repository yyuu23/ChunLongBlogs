"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** 阅读进度条：仅文章详情页顶部，随滚动增长的渐变细条 */
export function ReadingProgress() {
  const pathname = usePathname();
  const isPost = /^\/posts\/[^/]+$/.test(pathname);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPost) return;
    const bar = barRef.current;
    if (!bar) return;

    // 页面总高度缓存：内容/视口变化时（ResizeObserver/resize）才重算，
    // 而不是在每个 scroll 事件里读 scrollHeight（强制布局）。
    // 滚动回调只读 scrollY、rAF 合并为每帧一次、经 ref 直写样式——
    // 滚动全程零 React 重渲染（样式与过渡与原先完全一致）
    let total = document.documentElement.scrollHeight - window.innerHeight;
    let ticking = false;
    const apply = () => {
      ticking = false;
      const p = total > 0 ? Math.min(1, window.scrollY / total) : 0;
      bar.style.width = `${p * 100}%`;
    };
    const measure = () => {
      total = document.documentElement.scrollHeight - window.innerHeight;
      apply();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, [isPost]);

  if (!isPost) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-[3px]">
      <div
        ref={barRef}
        className="h-full bg-accent-gradient transition-[width] duration-150 ease-out"
        style={{ width: "0%" }}
      />
    </div>
  );
}
