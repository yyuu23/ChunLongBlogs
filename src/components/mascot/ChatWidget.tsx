"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, SendHorizonal, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/track";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/**
 * AI 聊天助手：悬浮在看板娘上方的小按钮 + 聊天面板
 * 接口走 /api/chat（服务端代理，Key 不暴露给浏览器）
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "你好呀！我是本站的 AI 小助手，有什么想聊的吗？(＾▽＾)" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    trackEvent("use_chat");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m.role === "user" || m.content !== undefined).slice(-16) }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMessages((ms) => [
        ...ms,
        { role: "assistant", content: data.reply ?? `出错了：${data.error ?? "未知错误"}` },
      ]);
    } catch {
      setMessages((ms) => [...ms, { role: "assistant", content: "网络异常，稍后再试试吧 (´;ω;`)" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="AI 聊天"
        className="glass-button accent-glow fixed bottom-[19rem] left-3 z-40 !rounded-full !p-3"
        title="和小助手聊天"
      >
        <MessageCircle className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-card fixed bottom-[21.5rem] left-3 z-40 flex h-96 w-[min(20rem,86vw)] flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-2.5">
              <p className="text-sm font-semibold">AI 小助手</p>
              <button onClick={() => setOpen(false)} aria-label="关闭聊天" className="rounded-full p-1 text-muted hover:text-rose-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <span
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent-gradient rounded-br-sm text-white"
                        : "rounded-bl-sm bg-white/50 dark:bg-white/10"
                    }`}
                  >
                    {m.content}
                  </span>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
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
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="说点什么…"
                className="glass-input flex-1 !rounded-2xl text-xs"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                aria-label="发送"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white transition-opacity disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
