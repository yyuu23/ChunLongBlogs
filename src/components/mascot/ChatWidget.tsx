"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, SendHorizonal, Loader2, Square } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { useEffects } from "@/components/providers/EffectProvider";
import { useChat } from "@/components/chat/useChat";
import { AffinityBadge } from "@/components/chat/AffinityBadge";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { PersonaAvatar } from "@/components/chat/PersonaArt";

/**
 * AI 聊天助手：悬浮在看板娘上方的小按钮 + 聊天面板
 * 接口走 /api/chat（服务端代理，Key 不暴露给浏览器），流式打字机输出。
 *
 * 坐标说明（桌面 md+）：看板娘画布高 340px、其气泡最坏顶到 ~384px，
 * 按钮放 392px（24.5rem）避让；面板底边 432px（27rem）与按钮顶 434px 咬合。
 * max-h 再扣 5rem 给固定顶栏（约 72px）——矮视口下面板顶部钳在 85px，不再压导航。
 * 移动端（<768px）无看板娘，维持贴底原位。
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
            className={`glass-card fixed left-3 z-40 flex h-[30rem] w-[min(20rem,86vw)] max-h-[calc(100dvh-26.5rem)] flex-col overflow-hidden ${
              mascotOff
                ? "bottom-[21.5rem]"
                : "bottom-[21.5rem] md:bottom-[27rem] md:max-h-[calc(100dvh-32rem)]"
            }`}
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
                      {m.model && <PersonaAvatar provider={m.model.provider} level={m.model.level} size={24} />}
                      <div className="min-w-0">
                      {(m.content || m.failed || (m.streaming && m.querying)) && (
                        <div className="w-fit max-w-full rounded-2xl rounded-bl-sm bg-white/50 px-3 py-2 text-xs leading-relaxed dark:bg-white/10">
                          {m.content ? (
                            <ChatMarkdown
                              content={m.streaming ? `${m.content}▍` : m.content}
                              streaming={m.streaming}
                            />
                          ) : (
                            <span className="flex items-center gap-1.5 text-muted">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {m.thinking
                                ? `🧠 ${t("chat.thinking")}…`
                                : m.toolLabel
                                  ? `🔍 ${m.toolLabel}…`
                                  : t("chat.querying")}
                            </span>
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
              {busy && !messages.at(-1)?.content && !messages.at(-1)?.querying && (
                <div className="flex items-start justify-start gap-1.5">
                  {messages.at(-1)?.model && (
                    <PersonaAvatar
                      provider={messages.at(-1)!.model!.provider}
                      level={messages.at(-1)!.model!.level}
                      size={24}
                    />
                  )}
                  <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/50 px-3 py-2.5 dark:bg-white/10">
                    <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                    <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                    <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                </div>
              )}
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
