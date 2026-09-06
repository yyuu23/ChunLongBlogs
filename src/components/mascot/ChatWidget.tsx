"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, MessageCircle, X, SendHorizonal, Square } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { useEffects } from "@/components/providers/EffectProvider";
import { useChat } from "@/components/chat/useChat";
import { AffinityBadge } from "@/components/chat/AffinityBadge";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { PersonaAvatar } from "@/components/chat/PersonaArt";
import { ChatStatusLine, statusPhaseOf } from "@/components/chat/ChatStatusLine";
import { attachImage, type AttachedImage } from "@/lib/imageAttach";

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
  const [pending, setPending] = useState<AttachedImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
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

  const addImageFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = 3 - pending.length;
    const added: AttachedImage[] = [];
    for (const f of imgs.slice(0, room)) {
      const a = await attachImage(f);
      if (a) added.push(a);
    }
    if (added.length) setPending((p) => [...p, ...added].slice(0, 3));
  };

  const doSend = () => {
    const text = input.trim();
    if ((!text && !pending.length) || busy) return;
    setInput("");
    const images = pending.length
      ? { full: pending.map((p) => p.full), thumbs: pending.map((p) => p.thumb) }
      : undefined;
    setPending([]);
    void send(text || t("chat.imageOnlyNote"), images);
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
                    <div className="flex max-w-[85%] flex-col items-end">
                      {m.images && m.images.length > 0 && (
                        <div className="mb-1 flex flex-wrap justify-end gap-1">
                          {m.images.map((src, j) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={j} src={src} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-[var(--glass-border)]" />
                          ))}
                        </div>
                      )}
                      <span className="whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-gradient px-3 py-2 text-xs leading-relaxed text-white">
                        {m.content}
                      </span>
                    </div>
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
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--glass-border)] p-2.5">
              {pending.length > 0 && (
                <div className="mb-1.5 flex gap-1.5">
                  {pending.map((p, i) => (
                    <span key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumb} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-[var(--glass-border)]" />
                      <button
                        type="button"
                        onClick={() => setPending((arr) => arr.filter((_, j) => j !== i))}
                        aria-label={t("chat.removeImage")}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  void addImageFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={pending.length >= 3}
                aria-label={t("chat.attach")}
                title={t("chat.attach")}
                className="glass-button shrink-0 !rounded-full !p-1.5 text-muted transition-colors hover:text-accent disabled:opacity-40"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={(e) => {
                  if (e.clipboardData.files.length) {
                    e.preventDefault();
                    void addImageFiles(e.clipboardData.files);
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && doSend()}
                placeholder={t("chat.placeholder")}
                className="glass-input min-w-0 flex-1 !rounded-2xl text-xs"
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
                  disabled={!input.trim() && !pending.length}
                  aria-label={t("chat.sendAria")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white transition-opacity disabled:opacity-40"
                >
                  <SendHorizonal className="h-4 w-4" />
                </button>
              )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
