"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useT } from "@/components/providers/LocaleProvider";

/**
 * 流式等待期的状态行（替代空气泡内嵌文字，/chat 与悬浮窗共用）：
 * [spinner] 阶段文案 · 轮换趣味短语 · 耗时（搜索时附关键词）
 * - 阶段：waiting（接洽中）→ thinking（深度思考）→ search（联网搜索）→ site（查站内）→ 正文淡入
 * - 趣味短语每 2.5s 轮换，耗时计数让"思考强度档位"的差距直接可见
 * - 头像由调用方渲染（传 cl-avatar-working 动画类），本组件只出药丸
 */

export type StatusPhase = "waiting" | "thinking" | "search" | "site";

const LABEL_KEY: Record<StatusPhase, string> = {
  waiting: "chat.status.waiting",
  thinking: "chat.status.thinking",
  search: "chat.status.search",
  site: "chat.status.site",
};
const PHRASE_KEY: Record<StatusPhase, string> = {
  waiting: "chat.phrases.waiting",
  thinking: "chat.phrases.thinking",
  search: "chat.phrases.search",
  site: "chat.phrases.site",
};
const PHASE_ICON: Record<StatusPhase, string> = {
  waiting: "✨",
  thinking: "🧠",
  search: "🔍",
  site: "📚",
};

export function ChatStatusLine({
  phase,
  detail,
  compact = false,
}: {
  phase: StatusPhase;
  /** 搜索关键词 / 工具参数摘要（可省） */
  detail?: string;
  /** 悬浮窗用小号 */
  compact?: boolean;
}) {
  const t = useT();
  const { tArr } = useLocale();
  const [elapsed, setElapsed] = useState(0);

  // 挂载即开始计时（状态行只在"尚无正文"期间存在）
  useEffect(() => {
    const t0 = performance.now();
    const timer = window.setInterval(() => setElapsed((performance.now() - t0) / 1000), 100);
    return () => window.clearInterval(timer);
  }, []);

  const phrases = tArr(PHRASE_KEY[phase]);
  const phrase = phrases.length ? phrases[Math.floor(elapsed / 2.5) % phrases.length] : "";
  const keyword =
    detail?.match(/query="([^"]{1,30})/)?.[1] ?? (detail ? detail.replace(/^[a-z_]+\((.*)\)$/, "$1").slice(0, 24) : "");

  return (
    <div
      className={`cl-status-pill glass-card inline-flex max-w-full items-center gap-2 !rounded-full ${
        compact ? "px-2.5 py-1.5 text-[0.6875rem]" : "px-3.5 py-2 text-xs"
      } text-muted`}
      role="status"
      aria-label={t(LABEL_KEY[phase])}
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="shrink-0 font-medium text-accent">
          {PHASE_ICON[phase]} {t(LABEL_KEY[phase])}
        </span>
        {keyword && (
          <span className="min-w-0 truncate font-mono text-[0.625rem] opacity-80">“{keyword}”</span>
        )}
        {phrase && <span className="shrink-0 opacity-75">· {phrase}</span>}
        <span className="shrink-0 font-mono text-[0.625rem] tabular-nums opacity-75">{elapsed.toFixed(1)}s</span>
      </span>
    </div>
  );
}

/** 消息的等待阶段推导（useChat 的中间态 → 状态行阶段） */
export function statusPhaseOf(m: {
  querying?: boolean;
  thinking?: boolean;
  toolName?: string;
}): StatusPhase {
  if (!m.querying) return "waiting";
  if (m.thinking) return "thinking";
  return m.toolName === "web_search" ? "search" : "site";
}
