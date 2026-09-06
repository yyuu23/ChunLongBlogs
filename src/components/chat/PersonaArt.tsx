"use client";

import { useEffect, useState } from "react";
import type { AiProvider } from "@/lib/site";
import type { ThinkingLevel } from "@/lib/llm-thinking";
import { useT } from "@/components/providers/LocaleProvider";
import { LazyImage } from "@/components/effects/Typewriter";
import { BrandLogo } from "./BrandLogo";

/**
 * 模型拟人形象（站长手绘素材；public/assets/persona/ 存 WebP 压缩版，
 * 原始 PNG 母版在项目根 assets-src/persona/，换图后重跑 scripts/compress-persona.mjs）：
 * - 低思考（off/low）用 calm 悠闲版，中高思考（mid/high/max/on）用 focus 认真版
 * - 头像版用于聊天气泡（圆形裁切），全身版用于模型选择弹窗的立绘
 * - 素材缺失/加载失败逐级回退：全身版隐藏、头像版回退品牌标
 */

const moodOf = (level: ThinkingLevel): "calm" | "focus" =>
  level === "off" || level === "low" ? "calm" : "focus";

export const personaAvatarSrc = (provider: AiProvider, level: ThinkingLevel) =>
  `/assets/persona/${provider}-${moodOf(level)}-avatar.webp`;

/** 预热某模型的全部拟人图（两 mood × 头像/立绘，共 ~55KB），打开弹窗/切换档位基本秒出 */
export function preheatPersona(provider: AiProvider) {
  if (typeof window === "undefined") return;
  for (const mood of ["calm", "focus"] as const) {
    for (const kind of ["avatar", "full"] as const) {
      const img = new Image();
      img.src = `/assets/persona/${provider}-${mood}-${kind}.webp`;
    }
  }
}

/** 聊天气泡 AI 头像（圆形，尺寸由调用方定）：原生 img 直接渲染 128px webp 源
 *  （不经 next/image 优化器二次压缩——小尺寸线稿图被 q75 重编码会糊），
 *  LazyImage 淡入 + shimmer 骨架，失败回退品牌标 */
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
  return (
    <span
      aria-hidden
      className={`relative shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      style={{ width: size, height: size }}
    >
      <LazyImage
        natural
        src={personaAvatarSrc(provider, level)}
        alt=""
        className="h-full w-full object-cover"
        fallback={<BrandLogo provider={provider} size={size} className="rounded-full" />}
      />
    </span>
  );
}

/** 弹窗立绘（透明全身像，柔影）：加载中显示骨架 + 「立绘加载中」，完成后淡入；素材缺失时返回 null 降级 */
export function PersonaFull({
  provider,
  level,
  className = "",
}: {
  provider: AiProvider;
  level: ThinkingLevel;
  className?: string;
}) {
  const t = useT();
  const src = `/assets/persona/${provider}-${moodOf(level)}-full.webp`;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // 切模型/档位时回到加载态（命中缓存时 onLoad 立即触发，骨架一闪而过）
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  if (failed) return null;
  return (
    <span aria-hidden className={`relative block h-40 sm:h-44 ${className}`}>
      {!loaded && (
        <span className="shimmer-bg absolute inset-0 flex items-center justify-center rounded-xl">
          <span className="text-[10px] tracking-widest text-muted/80">{t("chat.personaLoading")}</span>
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={`h-40 w-auto max-w-full object-contain object-top drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)] transition-opacity duration-500 sm:h-44 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
