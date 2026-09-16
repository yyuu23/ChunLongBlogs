"use client";

import { useState } from "react";
import { MessageCircle, SendHorizonal } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";

/**
 * 文章伴读条（正文卡之后）："有什么想问的？"输入框——唤起悬浮聊天窗并预填
 * （不自动发，访客确认）。文章上下文由 useChat 的 articleSlug 自动携带：
 * 服务端查全文注入，AI 回答"本文里"的问题以正文为准。
 */
export function ArticleAskBar() {
  const t = useT();
  const [text, setText] = useState("");

  const ask = () => {
    const q = text.trim();
    if (!q) return;
    setText("");
    window.dispatchEvent(new CustomEvent("cl-open-chat", { detail: { prefill: q } }));
  };

  return (
    <div className="glass-card mt-6 flex items-center gap-2 px-4 py-3">
      <MessageCircle className="h-4 w-4 shrink-0 text-accent" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && ask()}
        placeholder={t("posts.askPlaceholder")}
        aria-label={t("posts.askPlaceholder")}
        maxLength={500}
        className="glass-input min-w-0 flex-1 !rounded-full text-sm"
      />
      <button
        type="button"
        onClick={ask}
        disabled={!text.trim()}
        aria-label={t("posts.askAria")}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <SendHorizonal className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
