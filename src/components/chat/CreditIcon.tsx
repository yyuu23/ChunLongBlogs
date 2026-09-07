"use client";

import { useId } from "react";

/** AI 积分（✦）标志：四角星 + 品牌渐变（致敬 Gemini Sparkle），纯内联 SVG 矢量 */
export function CreditIcon({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  // useId 稳定生成渐变 id（SSR/CSR 一致）；去掉冒号防 url(#) 片段解析问题
  const raw = useId();
  const gid = `credit-star-${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#ef5350" />
          <stop offset="45%" stopColor="#66bb6a" />
          <stop offset="100%" stopColor="#42a5f5" />
        </linearGradient>
      </defs>
      {/* 凹边四角星：上下左右四个尖，Q 曲线内收成 Gemini Sparkle 轮廓 */}
      <path
        d="M12 0 Q13.6 10.4 24 12 Q13.6 13.6 12 24 Q10.4 13.6 0 12 Q10.4 10.4 12 0 Z"
        fill={`url(#${gid})`}
      />
    </svg>
  );
}
