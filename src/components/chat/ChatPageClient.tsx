"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  Cpu,
  FileText,
  History,
  Loader2,
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

/** 服务端下发的模型预设公开形态（只含 id/label，不泄露供应商与模型名） */
export interface AiChoicesPublic {
  allow: boolean;
  defaultChoice: string;
  choices: { id: string; label: string }[];
}

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
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // 模型选择（与悬浮窗共用 cl-chat-model 存储；后台关闭或预设 ≤1 时隐藏选择器）
  const showModelSelector = !!aiChoices?.allow && (aiChoices?.choices.length ?? 0) > 1;
  const [modelId, setModelId] = useState("");

  useEffect(() => {
    if (!aiChoices?.choices.length) return;
    const stored = localStorage.getItem("cl-chat-model");
    const id = stored && aiChoices.choices.some((c) => c.id === stored)
      ? stored
      : aiChoices.defaultChoice || aiChoices.choices[0]!.id;
    setModelId(id);
    localStorage.setItem("cl-chat-model", id);
  }, [aiChoices]);

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

  const doSend = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    touchSession(q); // 首次发送入索引（title 取本轮问题），此后刷新时间
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
    <div className="cl-chat-page mx-auto flex w-[min(96%,64rem)] gap-4">
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
            12rem = 主区上内边距(6.4) + 顶栏含间距(3.5) + 底部 pb-8(2) */}
        <div className="glass-card flex h-[calc(100dvh-12rem)] min-h-[24rem] flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                m={m}
                busy={busy}
                onRetry={retry}
                onRegenerate={(id, text) => {
                  touchSession(text);
                  void regenerateFrom(id, text);
                }}
              />
            ))}
            {busy && !messages.at(-1)?.content && !messages.at(-1)?.querying && (
              <div className="flex items-start gap-2.5">
                <Avatar />
                <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/50 px-3.5 py-3 dark:bg-white/10">
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                </span>
              </div>
            )}

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
              <div className="mb-2 flex items-center gap-1.5 text-[0.6875rem] text-muted">
                <Cpu className="h-3 w-3" />
                {t("chat.modelLabel")}
                <select
                  value={modelId}
                  onChange={(e) => {
                    setModelId(e.target.value);
                    localStorage.setItem("cl-chat-model", e.target.value);
                  }}
                  className="max-w-44 truncate rounded-full border border-[var(--glass-border)] bg-white/60 px-2.5 py-1 text-xs outline-none dark:bg-white/10"
                >
                  {aiChoices!.choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-end gap-2">
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
        <div className="glass-card mt-1.5 space-y-1 !rounded-xl px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-muted">
          {tools.map((x, i) => (
            <p key={i}>
              <span className="font-sans text-accent">{x.label}</span> — {x.detail}
            </p>
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
  onRegenerate,
}: {
  m: ChatMsg;
  busy: boolean;
  onRetry: () => void;
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
      <Avatar />
      <div className="group min-w-0 max-w-[calc(100%-2.75rem)]">
        {/* 无内容的流式等待期不渲染空气泡，交给下方的等待动画/查询提示 */}
        {(m.content || m.failed || (m.streaming && m.querying)) && (
          <div
            className={`w-fit max-w-full rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed ${
              m.failed ? "bg-rose-500/10 text-rose-600 dark:text-rose-300" : "bg-white/50 dark:bg-white/10"
            }`}
          >
            {m.content ? (
              <ChatMarkdown content={m.streaming ? `${m.content}▍` : m.content} streaming={m.streaming} />
            ) : (
              <span className="flex items-center gap-1.5 py-0.5 text-xs text-muted">
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
