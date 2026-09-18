/**
 * 长会话滚动摘要（纯客户端，localStorage 存储，零服务端状态）：
 * /chat 的每轮请求只携带最近 16 条消息，窗口之外的更早对话在这里压缩成
 * 摘要（POST /api/chat/summarize-turns），下一轮作为 summary 注入。
 * 失败静默——对话照常进行（只是丢了更早上下文），摘要下轮再试。
 */

const KEY_PREFIX = "cl-chat-sum-";
export const SUMMARY_WINDOW = 16; // 与 /api/chat 的 history 窗口一致
export const SUMMARY_EVERY = 8; // 每新溢出 8 条消息重新压缩一次

export interface SummaryState {
  /** 压缩稿（≤200 字） */
  text: string;
  /** 已折叠进摘要的消息条数（含欢迎语——与 messages 数组同基） */
  covered: number;
}

export function readSummary(sessionId: string): SummaryState | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + sessionId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SummaryState;
    if (typeof parsed.text === "string" && typeof parsed.covered === "number") return parsed;
  } catch {}
  return null;
}

export function writeSummary(sessionId: string, s: SummaryState) {
  try {
    localStorage.setItem(KEY_PREFIX + sessionId, JSON.stringify(s));
  } catch {}
}

export function clearSummary(sessionId: string) {
  try {
    localStorage.removeItem(KEY_PREFIX + sessionId);
  } catch {}
}

/** 是否需要压缩：稳定消息总数超窗口且新溢出量达到阈值 */
export function shouldSummarize(totalStable: number, covered: number): boolean {
  const overflow = totalStable - SUMMARY_WINDOW;
  return overflow >= 4 && overflow - covered >= SUMMARY_EVERY;
}

/**
 * 压缩溢出消息：overflowMsgs = 上一版摘要未覆盖的溢出段（从旧 covered 到当前窗口外沿），
 * 成功后 covered = coveredBase + overflowMsgs.length。30s 超时/失败返回 false（调用方静默跳过）。
 */
export async function summarizeOverflow(
  sessionId: string,
  overflowMsgs: { role: "user" | "assistant"; content: string }[],
  prev: string,
  coveredBase: number,
): Promise<boolean> {
  try {
    const res = await fetch("/api/chat/summarize-turns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: overflowMsgs.map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
        prevSummary: prev || undefined,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { summary?: string };
    if (!j.summary) return false;
    writeSummary(sessionId, { text: j.summary, covered: coveredBase + overflowMsgs.length });
    return true;
  } catch {
    return false;
  }
}
