"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eraser, MessageCircle, RefreshCw, SendHorizonal, Square } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { useChat } from "@/components/chat/useChat";
import { AffinityBadge } from "@/components/chat/AffinityBadge";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { PersonaAvatar } from "@/components/chat/PersonaArt";
import { ChatStatusLine, statusPhaseOf } from "@/components/chat/ChatStatusLine";
import { ModelPicker } from "@/components/chat/ModelPicker";
import type { AiChoicesPublic } from "@/lib/ai/choices";

/**
 * 文章伴读聊天面板（正文卡之后）：收起态是一行「读完有什么想问的」输入条，
 * 展开态是内联聊天卡——追问 / 切换模型与思考档 / 清空会话都在原地完成，
 * 不再唤起左下角悬浮窗。文章上下文由 useChat 的 articleSlug 自动携带
 * （服务端注入全文）；对话按文章 slug 独立持久化，重进文章还在。
 * 划词问 AI（ArticleSelectionAsk）经 cl-open-article-chat 唤起本面板并预填。
 */
export function ArticleChatPanel({ slug, aiChoices }: { slug: string; aiChoices: AiChoicesPublic }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { messages, busy, send, stop, clear, regenerateLast } = useChat({
    welcome: t("posts.companionWelcome"),
    persistKey: `article-chat:${slug}`,
  });

  /* 划词问 AI 的唤起通道：展开面板并预填（模板可能要改，由访客确认发送） */
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ prefill?: string }>).detail;
      setExpanded(true);
      if (typeof detail?.prefill === "string" && detail.prefill.trim()) {
        setInput(detail.prefill.slice(0, 2000));
        window.setTimeout(() => inputRef.current?.focus(), 120);
      }
    };
    window.addEventListener("cl-open-article-chat", onOpen);
    return () => window.removeEventListener("cl-open-article-chat", onOpen);
  }, []);

  /* 有历史对话时默认展开（重进文章能接着聊） */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`article-chat:${slug}`);
      if (raw) {
        const saved = JSON.parse(raw) as { messages?: unknown[] };
        if (Array.isArray(saved.messages) && saved.messages.length > 1) setExpanded(true);
      }
    } catch {
      // 解析失败视为无历史
    }
  }, [slug]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, expanded]);

  const doSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setExpanded(true);
    void send(text);
  };

  const showPicker = aiChoices.allow && aiChoices.choices.length > 0;

  return (
    <div className="glass-card mt-6 flex flex-col overflow-hidden">
      {!expanded ? (
        /* 收起态：沿用原伴读条的一行式输入（Enter 即发送并展开） */
        <div className="flex items-center gap-2 px-4 py-3">
          <MessageCircle className="h-4 w-4 shrink-0 text-accent" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSend()}
            placeholder={t("posts.askPlaceholder")}
            aria-label={t("posts.askPlaceholder")}
            maxLength={500}
            className="glass-input min-w-0 flex-1 !rounded-full text-sm"
          />
          <button
            type="button"
            onClick={doSend}
            disabled={!input.trim()}
            aria-label={t("posts.askAria")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <SendHorizonal className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-2.5">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <MessageCircle className="h-4 w-4 shrink-0 text-accent" />
              <span className="truncate">{t("posts.companionTitle")}</span>
              <AffinityBadge />
            </p>
            <div className="flex items-center gap-1.5">
              {showPicker && <ModelPicker aiChoices={aiChoices} />}
              <button
                type="button"
                onClick={clear}
                disabled={busy}
                aria-label={t("chatPage.clearAria")}
                title={t("chatPage.clear")}
                className="glass-button shrink-0 !rounded-full !p-1.5 text-muted transition-colors hover:text-rose-400 disabled:opacity-40"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label={t("posts.companionCollapse")}
                title={t("posts.companionCollapse")}
                className="glass-button shrink-0 !rounded-full !p-1.5 text-muted transition-colors hover:text-accent"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div ref={listRef} className="max-h-[min(28rem,60dvh)] space-y-2.5 overflow-y-auto px-3.5 py-3">
            {messages.map((m, i) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "user" ? (
                  <span className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-gradient px-3 py-2 text-xs leading-relaxed text-white">
                    {m.content}
                  </span>
                ) : (
                  <div className="flex min-w-0 max-w-[85%] items-start gap-1.5">
                    {m.model && (
                      <PersonaAvatar
                        provider={m.model.provider}
                        level={m.model.level}
                        size={24}
                        className={m.streaming && !m.content ? "cl-avatar-working" : ""}
                      />
                    )}
                    <div className="min-w-0">
                      {!m.streaming && m.reasoning && (
                        <details className="mb-1 w-fit rounded-lg border border-[var(--glass-border)] bg-white/30 px-2 py-1 dark:bg-white/5">
                          <summary className="cursor-pointer list-none text-[0.625rem] text-muted transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                            💭 {t("chat.thinkingTrace")}
                          </summary>
                          <p className="mt-1 max-h-28 overflow-y-auto border-t border-[var(--glass-border)] pt-1 text-[0.625rem] leading-relaxed whitespace-pre-wrap text-muted">
                            {m.reasoning}
                          </p>
                        </details>
                      )}
                      {!m.content && !m.failed && m.streaming && (
                        <ChatStatusLine phase={statusPhaseOf(m)} detail={m.toolDetail} compact />
                      )}
                      {(m.content || m.failed) && (
                        <div className="w-fit max-w-full rounded-2xl rounded-bl-sm bg-white/50 px-3 py-2 text-xs leading-relaxed dark:bg-white/10">
                          {m.content ? (
                            <ChatMarkdown
                              content={m.streaming ? `${m.content}▍` : m.content}
                              streaming={m.streaming}
                            />
                          ) : (
                            <span className="text-muted">{t("chat.unknownError")}</span>
                          )}
                        </div>
                      )}
                      {m.tools && m.tools.length > 0 && !m.streaming && (
                        <p className="mt-1 truncate text-[0.625rem] text-muted">
                          🔍 {m.tools.map((x) => x.label).join(" · ")}
                        </p>
                      )}
                      {i === messages.length - 1 && m.role === "assistant" && !m.streaming && !m.failed && !busy && (
                        <button
                          type="button"
                          onClick={() => void regenerateLast()}
                          title={t("chatPage.regenerate")}
                          className="mt-0.5 flex items-center gap-1 text-[0.625rem] text-muted transition-colors hover:text-accent"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--glass-border)] p-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSend()}
                placeholder={t("chat.placeholder")}
                aria-label={t("chat.placeholder")}
                maxLength={2000}
                className="glass-input min-w-0 flex-1 !rounded-2xl text-xs"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label={t("chat.stopAria")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={doSend}
                  disabled={!input.trim()}
                  aria-label={t("chat.sendAria")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white transition-opacity disabled:opacity-40"
                >
                  <SendHorizonal className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
