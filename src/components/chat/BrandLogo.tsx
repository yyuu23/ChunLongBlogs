"use client";

import { useState } from "react";
import type { AiProvider } from "@/lib/site";

/**
 * 供应商品牌标：优先 public/assets/logos/<provider>.png（官方素材），
 * 加载失败回退品牌色字母标——文件没放也不至于开天窗。
 * 统一白底圆角芯片容器，三家观感一致（黑底的 GLM、白底的鲸鱼/紫 Q 都协调）。
 */

const FALLBACK: Record<AiProvider, { grad: string; letter: string }> = {
  deepseek: { grad: "from-[#4D6BFE] to-[#3B5CE8]", letter: "D" },
  glm: { grad: "from-[#3859FF] to-[#7A5CFF]", letter: "G" },
  qwen: { grad: "from-[#7C3AED] to-[#A855F7]", letter: "Q" },
};

export function BrandLogo({
  provider,
  size = 20,
  className = "",
}: {
  provider: AiProvider;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const fb = FALLBACK[provider];

  if (failed) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-black text-white ${fb.grad} ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.55 }}
      >
        {fb.letter}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* 静态小图，无需 next/image 优化 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/logos/${provider}.png`}
        alt=""
        className="h-[80%] w-[80%] object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
