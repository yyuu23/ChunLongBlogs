"use client";

import { useState } from "react";
import type { AiProvider } from "@/lib/site";
import type { ThinkingLevel } from "@/lib/llm-thinking";
import { BrandLogo } from "./BrandLogo";

/**
 * 模型拟人形象（站长手绘素材，public/assets/persona/）：
 * - 低思考（off/low）用 calm 悠闲版，中高思考（mid/high/max/on）用 focus 认真版
 * - 头像版用于聊天气泡（圆形裁切），全身版用于模型选择弹窗的立绘
 * - 素材缺失/加载失败逐级回退：全身版隐藏、头像版回退品牌标
 */

const moodOf = (level: ThinkingLevel): "calm" | "focus" =>
  level === "off" || level === "low" ? "calm" : "focus";

export const personaAvatarSrc = (provider: AiProvider, level: ThinkingLevel) =>
  `/assets/persona/${provider}-${moodOf(level)}-avatar.png`;

/** 聊天气泡 AI 头像（32px 圆形） */
export function PersonaAvatar({
  provider,
  level,
  size = 32,
  className = "",
}: {
  provider: AiProvider;
  level: ThinkingLevel;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <BrandLogo provider={provider} size={size} className={`rounded-full ${className}`} />;
  return (
    <span
      aria-hidden
      className={`shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={personaAvatarSrc(provider, level)}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** 弹窗立绘（透明全身像，柔影）；流式布局由调用方排版，素材缺失时返回 null 降级 */
export function PersonaFull({
  provider,
  level,
  className = "",
}: {
  provider: AiProvider;
  level: ThinkingLevel;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/assets/persona/${provider}-${moodOf(level)}-full.png`}
      alt=""
      className={`h-40 w-auto max-w-full object-contain object-top drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)] sm:h-44 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
