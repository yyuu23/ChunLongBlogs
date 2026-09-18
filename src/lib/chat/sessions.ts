/**
 * /chat 页多会话管理（纯 localStorage，与站内"对话数据不落库"的隐私取舍一致）：
 * - 索引键 cl-chat-sessions 存元数据（id/title/updatedAt），按更新时间倒序，上限 20 个
 * - 每会话消息存独立键 cl-chat-s-{id}（由 useChat 的 persistKey 机制读写）
 * - 首次载入时把旧版单会话键 cl-chat-history 迁移成一个历史会话
 */
export interface ChatSessionMeta {
  id: string;
  title: string;
  updatedAt: number;
}

const INDEX_KEY = "cl-chat-sessions";
const LEGACY_KEY = "cl-chat-history";
/** 上次活跃会话 id：刷新 /chat 后直接回到该会话 */
export const ACTIVE_KEY = "cl-chat-active";
export const MAX_SESSIONS = 20;

/** 每会话消息的持久化键（传给 useChat 的 persistKey） */
export const sessionKey = (id: string) => `cl-chat-s-${id}`;

export function newSessionId(): string {
  return (
    crypto.randomUUID?.() ??
    `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

/** 会话标题：首条用户消息截 16 字 */
export function titleOf(firstUserText: string): string {
  const s = firstUserText.replace(/\s+/g, " ").trim();
  return s.length > 16 ? `${s.slice(0, 16)}…` : s;
}

function readIndex(): ChatSessionMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw) as { v?: number; items?: ChatSessionMeta[] };
    if (saved.v === 1 && Array.isArray(saved.items)) {
      return saved.items.filter((s) => s && typeof s.id === "string");
    }
  } catch {}
  return [];
}

function writeIndex(items: ChatSessionMeta[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify({ v: 1, items }));
  } catch {}
}

/**
 * 载入会话列表（含一次性 v1 迁移）。
 * 旧 cl-chat-history 若有实际对话，整体搬进新会话；无论成败都清掉旧键。
 */
export function loadSessions(): ChatSessionMeta[] {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      try {
        const saved = JSON.parse(legacyRaw) as {
          v?: number;
          messages?: Array<{ role?: string; content?: string }>;
        };
        const msgs = Array.isArray(saved.messages) ? saved.messages : [];
        const firstUser = msgs.find((m) => m.role === "user" && m.content);
        if (firstUser?.content) {
          const id = newSessionId();
          // 原样搬 v1 结构：useChat 的读取逻辑对 v1 格式直接兼容
          localStorage.setItem(sessionKey(id), legacyRaw);
          const idx = readIndex();
          idx.unshift({ id, title: titleOf(firstUser.content), updatedAt: Date.now() });
          writeIndex(idx.slice(0, MAX_SESSIONS));
        }
      } catch {}
      localStorage.removeItem(LEGACY_KEY);
    }
    return readIndex();
  } catch {
    return [];
  }
}

/** 写回索引（保持倒序 + 上限截断） */
export function saveSessions(items: ChatSessionMeta[]): ChatSessionMeta[] {
  const next = [...items].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
  writeIndex(next);
  return next;
}

/** 记住/读取上次活跃会话（读写失败静默） */
export function rememberActive(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {}
}

export function lastActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** 删除会话：索引摘除 + 消息键清理 */
export function removeSession(
  items: ChatSessionMeta[],
  id: string,
): ChatSessionMeta[] {
  try {
    localStorage.removeItem(sessionKey(id));
  } catch {}
  const next = items.filter((s) => s.id !== id);
  writeIndex(next);
  return next;
}

export type SessionGroupKey = "today" | "yesterday" | "earlier";

/** 按更新时间分组（今天 / 昨天 / 更早）；输入需已倒序 */
export function groupSessions(items: ChatSessionMeta[]): Map<SessionGroupKey, ChatSessionMeta[]> {
  const now = new Date();
  const dayOf = (ts: number) => {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const today = dayOf(now.getTime());
  const groups = new Map<SessionGroupKey, ChatSessionMeta[]>([
    ["today", []],
    ["yesterday", []],
    ["earlier", []],
  ]);
  for (const s of items) {
    const d = dayOf(s.updatedAt);
    if (d === today) groups.get("today")!.push(s);
    else if (d === today - 86_400_000) groups.get("yesterday")!.push(s);
    else groups.get("earlier")!.push(s);
  }
  return groups;
}
