"use client";

import { useEffect, useRef, useState, type DragEvent as RDragEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  FileText,
  History,
  ImagePlus,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SendHorizonal,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { useChat, type ChatMsg, type RelatedRef, type ToolTrace } from "./useChat";
import { AffinityBadge } from "@/components/chat/AffinityBadge";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { ModelPicker, type AiChoicesPublic } from "./ModelPicker";
import { PersonaAvatar } from "./PersonaArt";
import { ChatStatusLine, statusPhaseOf } from "./ChatStatusLine";
import { ImageLightbox, type LightboxState } from "./ImageLightbox";
import type { AiProvider } from "@/lib/site";
import type { ThinkingLevel } from "@/lib/llm-thinking";
import {
  groupSessions,
  lastActiveId,
  loadSessions,
  newSessionId,
  rememberActive,
  removeSession,
  saveSessions,
  sessionKey,
  titleOf,
  type ChatSessionMeta,
} from "@/lib/chatSessions";
import { copyText } from "@/lib/clipboard";
import { attachImage, type AttachedImage } from "@/lib/imageAttach";

export function ChatPageClient({ aiChoices }: { aiChoices?: AiChoicesPublic }) {
  const t = useT();
  const { tArr } = useLocale();
  // 初始恢复上次活跃会话（无记录才新开）；该 id 不在索引/无数据时 useChat 会重置为欢迎语
  const [activeId, setActiveId] = useState<string>(() => lastActiveId() ?? newSessionId());
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { messages, busy, send, retry, stop, clear, regenerateFrom } = useChat({
    welcome: t("chatPage.welcomeLong"),
    persistKey: sessionKey(activeId),
  });
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<AttachedImage[]>([]);
  /** 拖拽深度计数（dragenter/leave 成对触发，计数防子元素间移动时闪烁） */
  const [dragDepth, setDragDepth] = useState(0);
  /** 图片灯箱（点击气泡/预览图打开，放大查看） */
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 拖拽期间拦截 window 级默认行为：松手不会让浏览器直接打开图片文件
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const hasFiles = (e: RDragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const onDragEnter = (e: RDragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragDepth((d) => d + 1);
  };
  const onDragLeave = (e: RDragEvent) => {
    if (!hasFiles(e)) return;
    setDragDepth((d) => Math.max(0, d - 1));
  };
  const onDropFiles = (e: RDragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragDepth(0);
    void addImageFiles(e.dataTransfer.files);
  };
  // 模型/思考强度选择器（ModelPicker 内部管理 localStorage，悬浮窗共用同一存储）
  const showModelSelector = !!aiChoices?.allow && (aiChoices?.choices.length ?? 0) > 1;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // 挂载载入会话索引（含旧 cl-chat-history 的一次性迁移）
  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const setActive = (id: string) => {
    setActiveId(id);
    rememberActive(id);
  };

  /**
   * 会话入索引/刷新时间 —— 只在明确的用户动作点调用（发送/重生成）。
   * 不监听 messages 流：切换会话时 persistKey 重载是异步的，中间渲染里
   * "旧会话消息 + 新会话 id"会污染新会话的标题。
   */
  const touchSession = (currentText?: string) => {
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === activeId);
      const meta: ChatSessionMeta = {
        id: activeId,
        title: existing?.title ?? titleOf(currentText ?? "对话"),
        updatedAt: Date.now(),
      };
      return saveSessions([meta, ...prev.filter((s) => s.id !== activeId)]);
    });
  };
  const dropFromIndex = (id: string) => {
    setSessions((prev) => saveSessions(prev.filter((s) => s.id !== id)));
  };

  const switchTo = (id: string) => {
    stop(); // 在途流随会话一起放下
    setActive(id);
    setDrawerOpen(false);
  };
  const startNew = () => switchTo(newSessionId());
  const dropSession = (id: string) => {
    setSessions((prev) => removeSession(prev, id));
    if (id === activeId) {
      stop();
      setActive(newSessionId());
    }
  };

  /** 添加图片附件（文件选择/粘贴共用；解码压缩失败静默跳过） */
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

  const doSend = (text?: string) => {
    const q = (text ?? input).trim();
    if ((!q && !pending.length) || busy) return;
    touchSession(q || t("chat.imageOnlyNote")); // 首次发送入索引（title 取本轮问题），此后刷新时间
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    const images = pending.length
      ? {
          full: pending.map((p) => p.full),
          thumbs: pending.map((p) => p.thumb),
          views: pending.map((p) => p.view),
        }
      : undefined;
    setPending([]);
    void send(q || t("chat.imageOnlyNote"), images);
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

  // 对话进行中常驻的小提示：从"还没问过的"里按用户轮次确定性轮换 3 枚。
  // asked 由 messages 派生 —— 天然覆盖历史恢复/会话切换/编辑重生成三种场景
  const pool = tArr("chatPage.suggestions");
  const turnCount = messages.filter((m) => m.role === "user").length;
  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.content));
  const freshPool = pool.filter((s) => !asked.has(s));
  const source = freshPool.length >= 3 ? freshPool : pool; // 全问完则允许重新轮换
  const quickAsks = onlyWelcome
    ? []
    : [0, 1, 2]
        .map((i) => source[(turnCount * 3 + i) % source.length] ?? "")
        .filter(Boolean);

  const sidebar = (
    <SessionSidebar
      sessions={sessions}
      activeId={activeId}
      onSwitch={switchTo}
      onNew={startNew}
      onRemove={dropSession}
    />
  );

  return (
    <div
      className="cl-chat-page relative mx-auto flex w-[min(96%,64rem)] gap-4"
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDropFiles}
    >
      {/* 拖图入场：全屏虚化遮罩，对话卡抬升其上成为投递目标 */}
      {dragDepth > 0 && (
        <div className="fixed inset-0 z-[70] bg-black/25 backdrop-blur-sm" aria-hidden>
          <div className="absolute inset-x-0 top-6 flex flex-col items-center gap-1 text-center">
            <ImagePlus className="h-8 w-8 text-white/90" />
            <p className="text-sm font-medium text-white drop-shadow">{t("chat.dropHint")}</p>
            <p className="text-xs text-white/80 drop-shadow">{t("chat.dropHintSub")}</p>
          </div>
        </div>
      )}
      {/* 桌面侧栏：pt-14 精确跳过顶栏高度（h-11 + mb-3 = 56px），
          aside 本身不设高 —— 由外层 stretch 拉到主列总高，玻璃卡 flex-1 填满，
          顶部/底部即与聊天卡严格平齐 */}
      <aside className="hidden w-56 shrink-0 flex-col pt-14 lg:flex">{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 = 页面标题 + 工具条合并（定高 h-11：侧栏的 pt-14 与它精确配对） */}
        <div className="mb-3 flex h-11 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label={t("chatPage.history")}
              className="glass-button shrink-0 !rounded-full !p-2 lg:hidden"
            >
              <History className="h-4 w-4" />
            </button>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-br-gradient text-white">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg leading-tight font-black">
                {t("chatPage.title")}
              </h1>
              <p className="truncate text-[0.6875rem] text-muted">{t("chatPage.subtitle")}</p>
            </div>
            <AffinityBadge />
          </div>
          <button
            onClick={() => {
              clear();
              dropFromIndex(activeId); // 回到欢迎态的会话不再挂侧栏
            }}
            className="glass-button flex shrink-0 items-center gap-1.5 !rounded-full !px-3 !py-1.5 text-xs"
            aria-label={t("chatPage.clearAria")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("chatPage.clear")}
          </button>
        </div>

        {/* 消息卡片：dvh 高度，软键盘弹出（interactiveWidget）时随之收缩。
            页脚已收起（globals.css 的 body:has(.cl-chat-page)）；
            12rem = 主区上内边距(6.4) + 顶栏含间距(3.5) + 底部 pb-8(2)；
            拖图时抬到遮罩之上并虚线高亮为投递目标 */}
        <div
          className={`glass-card relative flex h-[calc(100dvh-12rem)] min-h-[24rem] flex-col overflow-hidden ${
            dragDepth > 0 ? "z-[71] ring-2 ring-accent ring-offset-2" : ""
          }`}
        >
          {dragDepth > 0 && (
            <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/70 bg-white/40 backdrop-blur-[2px] dark:bg-slate-900/40">
              <ImagePlus className="h-10 w-10 text-accent" />
              <p className="text-sm font-medium text-accent">{t("chat.dropHint")}</p>
              <p className="text-xs text-muted">{t("chat.dropHintSub")}</p>
            </div>
          )}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                m={m}
                busy={busy}
                onRetry={retry}
                onOpenImage={(index) =>
                  setLightbox({ srcs: m.viewImages ?? m.images ?? [], index })
                }
                onRegenerate={(id, text) => {
                  touchSession(text);
                  void regenerateFrom(id, text);
                }}
              />
            ))}

            {/* 空会话：快捷问题（大版） */}
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

          {/* 对话进行中的常驻小提示（首轮后不再裸奔） */}
          {quickAsks.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {quickAsks.map((s) => (
                <button
                  key={s}
                  onClick={() => doSend(s)}
                  className="glass-button shrink-0 !rounded-full !px-3 !py-1 text-[0.6875rem] text-muted transition-colors hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* 输入区 */}
          <div className="border-t border-[var(--glass-border)] p-3">
            {showModelSelector && (
              <div className="mb-2 flex items-center gap-2">
                <ModelPicker aiChoices={aiChoices!} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={pending.length >= 3}
                  aria-label={t("chat.attach")}
                  title={t("chat.attach")}
                  className="glass-button shrink-0 !rounded-full !p-1.5 text-muted transition-colors hover:text-accent disabled:opacity-40"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* 待发送图片预览 */}
            {pending.length > 0 && (
              <div className="mb-2 flex gap-2">
                {pending.map((p, i) => (
                  <span key={i} className="group/img relative">
                    <button
                      type="button"
                      onClick={() => setLightbox({ srcs: pending.map((x) => x.view), index: i })}
                      className="block transition-transform hover:scale-105"
                      aria-label={t("chat.imageViewer")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.thumb}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover ring-1 ring-[var(--glass-border)]"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending((arr) => arr.filter((_, j) => j !== i))}
                      aria-label={t("chat.removeImage")}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm"
                    >
                      <X className="h-3 w-3" />
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
            <div className="flex items-end gap-2">
              <textarea
                ref={taRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoGrow(e.currentTarget);
                }}
                onPaste={(e) => {
                  if (e.clipboardData.files.length) {
                    e.preventDefault();
                    void addImageFiles(e.clipboardData.files);
                  }
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
                  disabled={!input.trim() && !pending.length}
                  aria-label={t("chat.sendAria")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white transition-opacity disabled:opacity-40"
                >
                  <SendHorizonal className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 移动端历史抽屉 */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              className="fixed bottom-4 left-3 top-20 z-[61] w-64 lg:hidden"
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 图片灯箱 */}
      {lightbox && (
        <ImageLightbox
          state={lightbox}
          onClose={() => setLightbox(null)}
          onNav={(index) => setLightbox((st) => (st ? { ...st, index } : st))}
        />
      )}
    </div>
  );
}

/** AI 头像：有模型元信息时用对应拟人头像（随思考档位切悠闲/认真版），否则回退默认机器人标；
 *  working 态（等待回复中）附加轻微工作动画 */
function MsgAvatar({ model, working }: { model?: { provider: AiProvider; level: ThinkingLevel }; working?: boolean }) {
  const cls = working ? "cl-avatar-working" : "";
  if (model) return <PersonaAvatar provider={model.provider} level={model.level} size={32} className={cls} />;
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-br-gradient text-white shadow-sm ${cls}`}
    >
      <Bot className="h-4 w-4" />
    </span>
  );
}

/** 思考轨迹块：流式期间显示实时尾部；完成后折叠为可展开回看的摘要行 */
function ReasoningBlock({ text, streaming }: { text: string; streaming: boolean }) {
  const t = useT();
  if (streaming) {
    return (
      <div className="cl-status-pill mb-1.5 max-w-full rounded-xl border border-dashed border-[var(--glass-border)] bg-white/30 px-3 py-2 dark:bg-white/5">
        <p className="text-[0.625rem] font-medium text-muted">💭 {t("chat.thinkingTrace")}</p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[0.6875rem] leading-relaxed text-muted opacity-80">
          {text.slice(-400)}
        </p>
      </div>
    );
  }
  return (
    <details className="group/rt mb-1.5 w-fit rounded-xl border border-[var(--glass-border)] bg-white/30 px-3 py-1.5 dark:bg-white/5">
      <summary className="cursor-pointer list-none text-[0.625rem] font-medium text-muted transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
        💭 {t("chat.thinkingTrace")}
        <span className="mx-1 opacity-70">
          {text.length} {t("chat.traceUnit")}
        </span>
        <ChevronDown className="ml-0.5 inline h-3 w-3 transition-transform group-open/rt:rotate-180" />
      </summary>
      <p className="mt-1.5 max-h-44 overflow-y-auto border-t border-[var(--glass-border)] pt-1.5 text-[0.6875rem] leading-relaxed whitespace-pre-wrap text-muted">
        {text}
      </p>
    </details>
  );
}

/** 历史会话侧栏（桌面左栏与移动抽屉共用，高度由父容器定） */
function SessionSidebar({
  sessions,
  activeId,
  onSwitch,
  onNew,
  onRemove,
}: {
  sessions: ChatSessionMeta[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const groups = groupSessions(sessions);
  return (
    <div className="glass-card flex h-full w-full min-h-0 flex-col overflow-hidden">
      <div className="p-3">
        <button
          onClick={onNew}
          className="glass-button flex w-full items-center justify-center gap-1.5 !rounded-xl !py-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("chatPage.newChat")}
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-2 pb-3">
        {sessions.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted">{t("chatPage.noSessions")}</p>
        )}
        {(["today", "yesterday", "earlier"] as const).map((g) => {
          const list = groups.get(g) ?? [];
          if (!list.length) return null;
          return (
            <div key={g}>
              <p className="px-2 pb-1 text-[0.625rem] font-semibold tracking-widest text-muted">
                {t(`chatPage.${g}`)}
              </p>
              {list.map((s) => (
                <div key={s.id} className="group/session relative">
                  <button
                    onClick={() => onSwitch(s.id)}
                    title={s.title}
                    className={`w-full truncate rounded-lg px-2 py-1.5 pr-7 text-left text-xs transition-colors ${
                      s.id === activeId
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-muted hover:bg-white/40 dark:hover:bg-white/10"
                    }`}
                  >
                    {s.title}
                  </button>
                  <button
                    onClick={() => onRemove(s.id)}
                    aria-label={t("chatPage.deleteSessionAria")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted opacity-0 transition-all hover:text-rose-500 group-hover/session:opacity-100 max-lg:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 消息复制小按钮：成功换 ✓、失败换 ✗ 各两秒回弹（copyText 带 execCommand 兜底） */
function CopyBtn({ text }: { text: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(text).then((ok) => {
          setState(ok ? "ok" : "fail");
          window.setTimeout(() => setState("idle"), 2000);
        });
      }}
      aria-label={
        state === "ok"
          ? t("chatPage.copied")
          : state === "fail"
            ? t("chatPage.copyFailed")
            : t("chatPage.copyAria")
      }
      className="cl-msg-action"
    >
      {state === "ok" ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : state === "fail" ? (
        <X className="h-3 w-3 text-rose-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

/** 工具调用轨迹徽章：一排标签概览，点开显示每一步的工具名与参数摘要 */
function ToolsBadge({ tools }: { tools: ToolTrace[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass-card glass-hover flex max-w-full items-center gap-1.5 !rounded-full px-2.5 py-1 text-[0.6875rem] text-muted"
      >
        <Search className="h-3 w-3 shrink-0 text-accent" />
        <span className="truncate">
          {t("chatPage.toolsUsed")}: {tools.map((x) => x.label).join(" · ")}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="glass-card mt-1.5 space-y-1.5 !rounded-xl px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-muted">
          {tools.map((x, i) => (
            <div key={i}>
              <p>
                <span className="font-sans text-accent">{x.label}</span> — {x.detail}
              </p>
              {x.result && <p className="pl-3 opacity-75">↳ {x.result}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 单条消息：用户右侧渐变气泡（可编辑重生成）/ AI 左侧带头像气泡 + 来源卡 + 失败重试；两者都可复制 */
function MessageRow({
  m,
  busy,
  onRetry,
  onOpenImage,
  onRegenerate,
}: {
  m: ChatMsg;
  busy: boolean;
  onRetry: () => void;
  onOpenImage: (index: number) => void;
  onRegenerate: (id: string, text: string) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (m.role === "user") {
    if (editing) {
      const submit = () => {
        const q = draft.trim();
        if (!q) return;
        setEditing(false);
        onRegenerate(m.id, q);
      };
      return (
        <div className="flex justify-end">
          <div className="flex w-[min(100%,26rem)] flex-col gap-1.5">
            <textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                }
              }}
              className="glass-input resize-none !rounded-2xl text-sm leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="glass-button !rounded-full !px-3 !py-1 text-xs"
              >
                {t("chatPage.cancelEdit")}
              </button>
              <button
                onClick={submit}
                disabled={!draft.trim()}
                className="flex items-center gap-1 rounded-full bg-accent-gradient px-3 py-1 text-xs text-white transition-opacity disabled:opacity-40"
              >
                <RotateCcw className="h-3 w-3" />
                {t("chatPage.confirmEdit")}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="group flex flex-col items-end">
        {m.images && m.images.length > 0 && (
          <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
            {m.images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onOpenImage(i)}
                aria-label={t("chat.imageViewer")}
                className="block transition-transform hover:scale-105"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-20 w-20 rounded-xl object-cover ring-1 ring-[var(--glass-border)]"
                />
              </button>
            ))}
          </div>
        )}
        <span className="max-w-[calc(100%-2.75rem)] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-gradient px-4 py-2.5 text-sm leading-relaxed text-white">
          {m.content}
        </span>
        <div className="cl-msg-actions mt-0.5 flex gap-0.5">
          <CopyBtn text={m.content} />
          {!busy && (
            <button
              type="button"
              onClick={() => {
                setDraft(m.content);
                setEditing(true);
              }}
              aria-label={t("chatPage.edit")}
              className="cl-msg-action"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <MsgAvatar model={m.model} working={m.streaming && !m.content} />
      <div className="group min-w-0 max-w-[calc(100%-2.75rem)]">
        {/* 思考轨迹：流式期间实时尾部，完成后折叠可回看 */}
        {m.reasoning && <ReasoningBlock text={m.reasoning} streaming={!!m.streaming} />}
        {/* 等待期：独立状态行（思考/搜索/站内阶段 + 耗时），首个正文到达后切换为气泡 */}
        {!m.content && !m.failed && m.streaming && (
          <ChatStatusLine phase={statusPhaseOf(m)} detail={m.toolDetail} />
        )}
        {(m.content || m.failed) && (
          <div
            className={`w-fit max-w-full rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed ${
              m.failed ? "bg-rose-500/10 text-rose-600 dark:text-rose-300" : "bg-white/50 dark:bg-white/10"
            }`}
          >
            {m.content ? (
              <ChatMarkdown content={m.streaming ? `${m.content}▍` : m.content} streaming={m.streaming} />
            ) : (
              <span className="text-xs text-muted">{t("chat.unknownError")}</span>
            )}
          </div>
        )}

        {/* 工具调用轨迹（可展开看每步查了什么） */}
        {m.tools && m.tools.length > 0 && !m.streaming && <ToolsBadge tools={m.tools} />}

        {/* 参考来源 */}
        {m.related && m.related.length > 0 && !m.streaming && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[0.625rem] text-muted">{t("chatPage.sources")}</span>
            {m.related.map((r) => (
              <SourceChip key={r.slug ?? r.momentId} r={r} />
            ))}
          </div>
        )}

        {/* 复制 + 失败重试 */}
        <div className="cl-msg-actions mt-0.5 flex items-center gap-2">
          {!m.streaming && !m.failed && <CopyBtn text={m.content} />}
          {m.failed && !m.streaming && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
            >
              <RotateCcw className="h-3 w-3" />
              {t("chatPage.retry")}
            </button>
          )}
        </div>
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
