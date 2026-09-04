"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent, getVisitorId } from "@/lib/track";
import { useT } from "@/components/providers/LocaleProvider";

/** 参考来源（与 /api/chat 的 related 同构） */
export interface RelatedRef {
  kind: "post" | "moment";
  title?: string;
  slug?: string;
  momentId?: number;
  date?: string;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  /** 流式生成中 */
  streaming?: boolean;
  /** 参考来源（AI 消息） */
  related?: RelatedRef[];
  /** 失败（显示重试） */
  failed?: boolean;
}

const HISTORY_VERSION = 1;
const MAX_PERSIST = 50;

/** SSE 流里的事件负载 */
interface SsePayload {
  text?: string;
  message?: string;
}

/**
 * 聊天状态机（悬浮窗与 /chat 页共用一份实现，避免两处流式逻辑漂移）。
 * POST /api/chat {stream:true} → 消费 SSE：related → delta* → done/error。
 * persistKey 传入时启用 localStorage 历史持久化（仅客户端读写，SSR 安全）。
 */
export function useChat({ welcome, persistKey }: { welcome: string; persistKey?: string }) {
  const t = useT();
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: welcome }]);
  const [busy, setBusy] = useState(false);
  const acRef = useRef<AbortController | null>(null);
  const persistTimer = useRef<number | null>(null);

  /** 恢复历史：只在挂载后读 localStorage，首帧恒为欢迎语（无 hydration 不一致） */
  useEffect(() => {
    if (!persistKey) return;
    try {
      const raw = localStorage.getItem(persistKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { v?: number; messages?: ChatMsg[] };
      if (saved.v === HISTORY_VERSION && Array.isArray(saved.messages) && saved.messages.length) {
        // 剥离流式/失败等中间态，只留稳定消息
        setMessages(
          saved.messages.map((m) => ({ role: m.role, content: m.content, related: m.related })),
        );
      }
    } catch {}
  }, [persistKey]);

  /** 持久化：防抖 500ms，剥离中间态；只剩欢迎语时清键 */
  useEffect(() => {
    if (!persistKey) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      try {
        const clean = messages
          .filter((m) => !m.failed && !m.streaming)
          .slice(-MAX_PERSIST)
          .map((m) => ({ role: m.role, content: m.content, related: m.related }));
        if (clean.length <= 1) {
          localStorage.removeItem(persistKey);
          return;
        }
        localStorage.setItem(persistKey, JSON.stringify({ v: HISTORY_VERSION, messages: clean }));
      } catch {}
    }, 500);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [messages, persistKey]);

  /** 卸载时中断在途请求（服务端 request.signal 联动取消上游） */
  useEffect(() => () => acRef.current?.abort(), []);

  const patchLast = (patch: Partial<ChatMsg>) => {
    setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 ? { ...m, ...patch } : m)));
  };

  const appendDelta = (text: string) => {
    setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 ? { ...m, content: m.content + text } : m)));
  };

  /** 跑一轮对话：history 已含最新 user 消息，尾部追加流式 assistant */
  const runTurn = useCallback(
    async (history: ChatMsg[]) => {
      setMessages([...history, { role: "assistant", content: "", streaming: true }]);
      setBusy(true);
      const ac = new AbortController();
      acRef.current = ac;
      let gotAny = false;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.slice(-16),
            stream: true,
            localHour: new Date().getHours(),
            visitorId: getVisitorId(),
          }),
          signal: ac.signal,
        });

        if (!res.ok) {
          let msg = t("chat.unknownError");
          if (res.status === 429) {
            msg = t("chat.rateLimited");
          } else {
            try {
              const j = (await res.json()) as { error?: string };
              if (j.error) msg = j.error;
            } catch {}
          }
          patchLast({
            content: res.status === 429 ? msg : `${t("chat.errorPrefix")}${msg}`,
            streaming: false,
            failed: true,
          });
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? ""; // 最后一段可能不完整，留给下一块
          for (const part of parts) {
            let event = "message";
            const dataLines: string[] = [];
            for (const line of part.split("\n")) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
            }
            if (!dataLines.length) continue;
            let payload: SsePayload;
            try {
              payload = JSON.parse(dataLines.join("\n")) as SsePayload;
            } catch {
              continue;
            }
            if (event === "related") {
              patchLast({ related: Array.isArray(payload) ? (payload as unknown as RelatedRef[]) : [] });
            } else if (event === "delta" && typeof payload.text === "string") {
              gotAny = true;
              appendDelta(payload.text);
            } else if (event === "error") {
              patchLast({
                content: `${t("chat.errorPrefix")}${payload.message ?? t("chat.unknownError")}`,
                streaming: false,
                failed: !gotAny,
              });
            } else if (event === "done") {
              setMessages((ms) =>
                ms.map((m, i) => {
                  if (i !== ms.length - 1) return m;
                  if (m.content) return { ...m, streaming: false };
                  // done 但一个字都没收到
                  return { ...m, content: t("chat.unknownError"), streaming: false, failed: true };
                }),
              );
            }
          }
        }
        patchLast({ streaming: false }); // 上游没发 done 的兜底
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          // 用户主动停止：保留已生成部分
          patchLast({ streaming: false });
        } else {
          patchLast({ content: t("chat.networkError"), streaming: false, failed: true });
        }
      } finally {
        setBusy(false);
        acRef.current = null;
      }
    },
    [t],
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      trackEvent("use_chat");
      const history = [
        ...messages.filter((m) => !m.failed && !m.streaming),
        { role: "user" as const, content: q },
      ];
      await runTurn(history);
    },
    [busy, messages, runTurn],
  );

  /** 重试：弹掉尾部失败消息，用剩余历史（末尾是 user）重跑一轮 */
  const retry = useCallback(async () => {
    if (busy) return;
    const ms = [...messages];
    while (ms.length && ms.at(-1)!.role === "assistant" && ms.at(-1)!.failed) ms.pop();
    if (!ms.length || ms.at(-1)!.role !== "user") return;
    await runTurn(ms);
  }, [busy, messages, runTurn]);

  const stop = useCallback(() => acRef.current?.abort(), []);

  const clear = useCallback(() => {
    acRef.current?.abort();
    setMessages([{ role: "assistant", content: welcome }]);
    if (persistKey) {
      try {
        localStorage.removeItem(persistKey);
      } catch {}
    }
  }, [welcome, persistKey]);

  return { messages, busy, send, retry, stop, clear };
}
