"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** 阅读进度条：仅文章详情页顶部，随滚动增长的渐变细条 */
export function ReadingProgress() {
  const pathname = usePathname();
  const isPost = /^\/posts\/[^/]+$/.test(pathname);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isPost) return;
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(1, window.scrollY / total) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isPost]);

  if (!isPost) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-[3px]">
      <div
        className="h-full bg-accent-gradient transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
