"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  Bot,
  FileText,
  MessageSquareText,
  RotateCcw,
  SendHorizonal,
  Square,
  Trash2,
} from "lucide-react";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { useChat, type ChatMsg, type RelatedRef } from "./useChat";
import { AffinityBadge } from "@/components/chat/AffinityBadge";

const PERSIST_KEY = "cl-chat-history";

export function ChatPageClient() {
  const t = useT();
  const { tArr } = useLocale();
  const { messages, busy, send, retry, stop, clear } = useChat({
    welcome: t("chatPage.welcomeLong"),
    persistKey: PERSIST_KEY,
  });
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const doSend = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    void send(q);
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };

  const onlyWelcome = messages.length === 1 && messages[0]!.role === "assistant";
  const suggestions = onlyWelcome ? tArr("chatPage.suggestions") : [];

  return (
    <div className="mx-auto flex w-[min(96%,48rem)] flex-col">
      {/* 工具条 */}
      <div className="mb-3 flex items-center justify-between">
        <AffinityBadge />
        <button
          onClick={clear}
          className="glass-button flex items-center gap-1.5 !rounded-full !px-3 !py-1.5 text-xs"
          aria-label={t("chatPage.clearAria")}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("chatPage.clear")}
        </button>
      </div>

      {/* 消息卡片：dvh 高度，软键盘弹出（interactiveWidget）时随之收缩 */}
      <div className="glass-card flex h-[calc(100dvh-21rem)] min-h-[22rem] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {messages.map((m, i) => (
            <MessageRow key={i} m={m} onRetry={retry} />
          ))}
          {busy && !messages.at(-1)?.content && (
            <div className="flex items-start gap-2.5">
              <Avatar />
              <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/50 px-3.5 py-3 dark:bg-white/10">
                <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
              </span>
            </div>
          )}

          {/* 空会话：快捷问题 */}
          {onlyWelcome && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => doSend(s)}
                  className="glass-button !rounded-full !px-3.5 !py-1.5 text-xs text-muted transition-colors hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* 输入区 */}
        <div className="flex items-end gap-2 border-t border-[var(--glass-border)] p-3">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow(e.currentTarget);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("chatPage.inputPlaceholder")}
            className="glass-input max-h-32 flex-1 resize-none !rounded-2xl text-sm leading-relaxed"
          />
          {busy ? (
            <button
              onClick={stop}
              aria-label={t("chat.stopAria")}
              title={t("chat.stopAria")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => doSend()}
              disabled={!input.trim()}
              aria-label={t("chat.sendAria")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white transition-opacity disabled:opacity-40"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-br-gradient text-white shadow-sm">
      <Bot className="h-4 w-4" />
    </span>
  );
}

/** 单条消息：用户右侧渐变气泡 / AI 左侧带头像气泡 + 参考来源卡片 + 失败重试 */
function MessageRow({ m, onRetry }: { m: ChatMsg; onRetry: () => void }) {
  const t = useT();

  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <span className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-gradient px-4 py-2.5 text-sm leading-relaxed text-white">
          {m.content}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <Avatar />
      <div className="min-w-0 max-w-[calc(100%-2.75rem)]">
        <span
          className={`inline-block whitespace-pre-wrap rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed ${
            m.failed ? "bg-rose-500/10 text-rose-600 dark:text-rose-300" : "bg-white/50 dark:bg-white/10"
          }`}
        >
          {m.content}
          {m.streaming && m.content && <span className="animate-pulse">▍</span>}
        </span>

        {/* 参考来源 */}
        {m.related && m.related.length > 0 && !m.streaming && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-muted">{t("chatPage.sources")}</span>
            {m.related.map((r, i) => (
              <SourceChip key={i} r={r} />
            ))}
          </div>
        )}

        {/* 失败重试 */}
        {m.failed && !m.streaming && (
          <button
            onClick={onRetry}
            className="mt-1.5 flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
          >
            <RotateCcw className="h-3 w-3" />
            {t("chatPage.retry")}
          </button>
        )}
      </div>
    </div>
  );
}

/** 来源卡片：文章跳 /posts/slug，说说跳 /moments 锚点 */
function SourceChip({ r }: { r: RelatedRef }) {
  const t = useT();
  if (r.kind === "post") {
    return (
      <Link
        href={`/posts/${r.slug}`}
        className="glass-card glass-hover flex items-center gap-1.5 !rounded-full px-3 py-1 text-xs"
      >
        <FileText className="h-3 w-3 text-accent" />
        <span className="max-w-40 truncate">
          {t("chatPage.fromPost")} · {r.title}
        </span>
      </Link>
    );
  }
  return (
    <Link
      href={`/moments#moment-${r.momentId}`}
      className="glass-card glass-hover flex items-center gap-1.5 !rounded-full px-3 py-1 text-xs"
    >
      <MessageSquareText className="h-3 w-3 text-accent" />
      {t("chatPage.fromMoment")} · {r.date}
    </Link>
  );
}
