"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, SendHorizonal, Square } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { useEffects } from "@/components/providers/EffectProvider";
import { useChat } from "@/components/chat/useChat";
import { AffinityBadge } from "@/components/chat/AffinityBadge";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { PersonaAvatar } from "@/components/chat/PersonaArt";
import { ChatStatusLine, statusPhaseOf } from "@/components/chat/ChatStatusLine";

/**
 * AI 聊天助手：悬浮在看板娘上方的小按钮 + 聊天面板
 * 接口走 /api/chat（服务端代理，Key 不暴露给浏览器），流式打字机输出。
 *
 * 布局：按钮常驻左下（避让看板娘与其气泡）；面板展开后改为「驻底」——
 * bottom-3 落到视口底部、高 min(38rem, dvh-7.5rem)（顶部恒让开导航栏），
 * 打开期间覆盖按钮（用面板顶栏的 ✕ 关闭），看板娘经 CSS 淡出避免玻璃后虚影。
 */
export function ChatWidget() {
  const t = useT();
  const pathname = usePathname();
  const { effects, hydrated } = useEffects();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, busy, send, stop } = useChat({ welcome: t("chat.welcome") });
  const listRef = useRef<HTMLDivElement>(null);

  // /chat 页有自己的完整聊天界面，这里隐藏避免双入口
  const onChatPage = pathname === "/chat";
  // 看板娘被用户关闭时左下空无一物，按钮回贴底，别悬在半空
  const mascotOff = hydrated && !effects.mascot;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  if (onChatPage) return null;

  const doSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void send(text);
  };

  return (
    <>
      <button
        data-cl-chrome
        onClick={() => setOpen((v) => !v)}
        aria-label={t("chat.openAria")}
        className={`glass-button accent-glow fixed left-3 z-40 !rounded-full !p-3 ${
          mascotOff ? "bottom-[19rem]" : "bottom-[19rem] md:bottom-[24.5rem]"
        }`}
        title={t("chat.title")}
      >
        <MessageCircle className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-cl-chrome
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-card cl-chat-panel-open fixed bottom-3 left-3 z-40 flex h-[min(38rem,calc(100dvh-7.5rem))] w-[min(20rem,86vw)] flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-2.5">
              <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <span className="truncate">AI 小助手</span>
                <AffinityBadge />
              </p>
              <button onClick={() => setOpen(false)} aria-label={t("chat.closeAria")} className="rounded-full p-1 text-muted hover:text-rose-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-[var(--glass-border)] p-2.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSend()}
                placeholder={t("chat.placeholder")}
                className="glass-input flex-1 !rounded-2xl text-xs"
              />
              {busy ? (
                <button
                  onClick={stop}
                  aria-label={t("chat.stopAria")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={doSend}
                  disabled={!input.trim()}
                  aria-label={t("chat.sendAria")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white transition-opacity disabled:opacity-40"
                >
                  <SendHorizonal className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
