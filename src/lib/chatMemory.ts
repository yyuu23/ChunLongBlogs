"use client";

/**
 * 记忆小本本（客户端工具）：AI 的长期访客记忆，只存访客自己的 localStorage（key cl-chat-memory，
 * 换设备/清缓存即丢——隐私优先的取舍）；要点提取走 /api/chat/memory（服务端 LLM 浓缩，不落库）。
 * 全部函数 SSR 安全（先判 typeof window）。clear() 不清记忆——"清空会话"只清当前对话，
 * 记忆是长期资产（设计决策）。
 */

const KEY = "cl-chat-memory";
const MAX_LINES = 12;
const MAX_LINE = 60;
const MAX_TOTAL = 800;
const EXPIRE_MS = 30 * 24 * 3600_000;
/** 每累积多少次成功的 user 发言，触发一次提取 */
const EXTRACT_EVERY = 4;

interface MemoryState {
  v: 1;
  updatedAt: number;
  /** 自上次提取后的 user 发言数 */
  turns: number;
  digest: string;
}

/** 长度钳制：12 行 / 行 60 字 / 总 800 字。不信任何来源——本机存储、LLM 输出、网络响应。 */
export function clampDigest(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .map((l) => l.slice(0, MAX_LINE))
    .slice(0, MAX_LINES);
  const out = lines.join("\n");
  return out.length > MAX_TOTAL ? out.slice(0, MAX_TOTAL) : out;
}

function read(): MemoryState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as MemoryState;
    if (s?.v !== 1 || typeof s.digest !== "string") return null;
    if (Date.now() - (s.updatedAt || 0) > EXPIRE_MS) return null; // 30 天未见，当作重新认识
    return s;
  } catch {
    return null;
  }
}

/** 供每轮 body 注入的记忆文本（空串 = 无记忆，服务端跳过注入） */
export function readDigest(): string {
  return clampDigest(read()?.digest ?? "");
}

/**
 * turn 成功后计数，累积 EXTRACT_EVERY 轮触发一次异步提取（fire-and-forget，任何失败静默）。
 * 提取请求带最近 10 条稳定消息 + 当前 digest；sessionStorage 哨兵防两入口并发提取。
 */
export function noteTurn(messages: { role: string; content: string }[]): void {
  if (typeof window === "undefined") return;
  const s = read();
  const turns = (s?.turns ?? 0) + 1;
  if (turns < EXTRACT_EVERY) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, updatedAt: s?.updatedAt ?? 0, turns, digest: s?.digest ?? "" }));
    } catch {}
    return;
  }
  // 达阈值：先清零（提取失败也要再等一轮周期，天然限频），再尝试提取
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, updatedAt: s?.updatedAt ?? 0, turns: 0, digest: s?.digest ?? "" }));
  } catch {}
  try {
    if (sessionStorage.getItem("cl-mem-extracting")) return;
    sessionStorage.setItem("cl-mem-extracting", "1");
  } catch {}
  const recent = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-10);
  fetch("/api/chat/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: recent, digest: readDigest() }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { memory?: string } | null) => {
      if (!d || typeof d.memory !== "string") return;
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({ v: 1, updatedAt: Date.now(), turns: 0, digest: clampDigest(d.memory) }),
        );
      } catch {}
    })
    .catch(() => {})
    .finally(() => {
      try {
        sessionStorage.removeItem("cl-mem-extracting");
      } catch {}
    });
}
