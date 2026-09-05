"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { trackEvent, getVisitorId } from "@/lib/track";
import { useT } from "@/components/providers/LocaleProvider";
import { createMoodFilter } from "@/lib/moodStream";
import { readDigest, noteTurn } from "@/lib/chatMemory";
import type { AiProvider } from "@/lib/site";
import type { ThinkingLevel } from "@/lib/llm-thinking";

/** 参考来源（与 /api/chat 的 related 同构） */
export interface RelatedRef {
  kind: "post" | "moment";
  title?: string;
  slug?: string;
  momentId?: number;
  date?: string;
}

/** 工具调用轨迹（与 /api/chat 的 tools 事件同构） */
export interface ToolTrace {
  name: string;
  label: string;
  detail: string;
}

export interface ChatMsg {
  /** 消息唯一 id（编辑重生成要按 id 定位截断；旧持久化数据载入时补齐） */
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 流式生成中 */
  streaming?: boolean;
  /** 服务端正在调用站内数据工具（status 事件置位，首个 delta 到达后清除） */
  querying?: boolean;
  /** querying 期间当前工具的标签（如「查询文章列表」），供等待提示展示 */
  toolLabel?: string;
  /** 思考模式推理中（status 事件置位，正文 delta 到达后清除） */
  thinking?: boolean;
  /** 本条回答用到的工具轨迹（AI 消息，随会话持久化） */
  tools?: ToolTrace[];
  /** 参考来源（AI 消息） */
  related?: RelatedRef[];
  /** 本条回答用的模型元信息（AI 消息；头像随模型与思考档位切换，随会话持久化） */
  model?: { provider: AiProvider; level: ThinkingLevel };
  /** 失败（显示重试） */
  failed?: boolean;
}

const HISTORY_VERSION = 1;
const MAX_PERSIST = 50;

const uid = () =>
  crypto.randomUUID?.() ??
  `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** SSE 流里的事件负载 */
interface SsePayload {
  text?: string;
  message?: string;
  stage?: string;
  label?: string;
}

/**
 * 聊天状态机（悬浮窗与 /chat 页共用一份实现，避免两处流式逻辑漂移）。
 * POST /api/chat {stream:true} → 消费 SSE：related → delta* → done/error。
 * persistKey 传入时启用 localStorage 历史持久化（仅客户端读写，SSR 安全）。
 */
export function useChat({ welcome, persistKey }: { welcome: string; persistKey?: string }) {
  const t = useT();
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: uid(), role: "assistant", content: welcome },
  ]);
  const [busy, setBusy] = useState(false);
  const acRef = useRef<AbortController | null>(null);
  const persistTimer = useRef<number | null>(null);

  /** 恢复/重载历史：挂载及 persistKey 变化（多会话切换）时读 localStorage。
   *  键无数据 → 重置为欢迎语（新会话）；首帧恒为欢迎语，无 hydration 不一致。
   *  悬浮窗不传 persistKey → 此 effect 永不介入，行为不变。 */
  useEffect(() => {
    if (!persistKey) return;
    let restored: ChatMsg[] | null = null;
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) {
        const saved = JSON.parse(raw) as { v?: number; messages?: ChatMsg[] };
        if (saved.v === HISTORY_VERSION && Array.isArray(saved.messages) && saved.messages.length) {
          // 剥离流式/失败等中间态，只留稳定消息；旧数据无 id 就地补齐
          restored = saved.messages.map((m) => ({
            id: m.id ?? uid(),
            role: m.role,
            content: m.content,
            related: m.related,
            tools: m.tools,
            model: m.model,
          }));
        }
      }
    } catch {}
    setMessages(restored ?? [{ id: uid(), role: "assistant", content: welcome }]);
  }, [persistKey, welcome]);

  /** 持久化：防抖 500ms，剥离中间态；只剩欢迎语时清键 */
  useEffect(() => {
    if (!persistKey) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      try {
        const clean = messages
          .filter((m) => !m.failed && !m.streaming)
          .slice(-MAX_PERSIST)
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            related: m.related,
            tools: m.tools,
            model: m.model,
          }));
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
      // 当前模型选择（ModelPicker 写入；悬浮窗与页面共用）——档位随模型存，头像元信息随消息走
      const chatModel = localStorage.getItem("cl-chat-model");
      const chatEffort =
        (chatModel && localStorage.getItem(`cl-chat-effort:${chatModel}`)) || undefined;
      const chatProviderRaw = localStorage.getItem("cl-chat-provider");
      const chatProvider: AiProvider | undefined =
        chatProviderRaw === "glm" || chatProviderRaw === "deepseek" || chatProviderRaw === "qwen"
          ? chatProviderRaw
          : undefined;
      const meta = chatProvider
        ? { provider: chatProvider, level: (chatEffort as ThinkingLevel) ?? "off" }
        : undefined;
      setMessages([
        ...history,
        { id: uid(), role: "assistant", content: "", streaming: true, model: meta },
      ]);
      setBusy(true);
      const ac = new AbortController();
      acRef.current = ac;
      let gotAny = false;
      let replyText = ""; // 剥离标记后的完整回复(记忆提取的输入)
      const moodFilter = createMoodFilter(); // 每轮一个:流式剥离 [mood:xxx],append 前剥离故持久化天然干净
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.slice(-16),
            stream: true,
            localHour: new Date().getHours(),
            visitorId: getVisitorId(),
            // 访客选的模型预设 id + 思考档位（/chat 页选择器写入；悬浮窗共用同一存储）
            model: chatModel ?? undefined,
            effort: chatEffort,
            // 页面感知：/chat 页跳过（该页注入无意义）；文章详情页带标题让 AI 知道访客在读什么
            page: pathname === "/chat" ? undefined : pathname,
            pageTitle:
              pathname && /^\/posts\/[^/]+$/.test(pathname)
                ? document.title.split(" - ")[0].slice(0, 60)
                : undefined,
            // 记忆小本本：本机 localStorage 的长期记忆注入（服务端按不可信数据包裹）
            memory: readDigest(),
          }),
          signal: ac.signal,
        });

        if (!res.ok) {
          // 先读 body 再判类型：429 可能是分钟限流(无 code)也可能是日限额(chat_daily_limit)
          let msg = t("chat.unknownError");
          if (res.status === 429) {
            msg = t("chat.rateLimited");
            try {
              const j = (await res.json()) as { code?: string };
              if (j.code === "chat_daily_limit") msg = t("chat.dailyLimit");
              else if (j.code === "chat_user_limit") msg = t("chat.userLimit");
            } catch {}
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
        let querying = false; // status 事件置位：UI 显示「正在翻站内资料…」，首个 delta 清除
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
            } else if (event === "status" && (payload.stage === "tools" || payload.stage === "tool")) {
              // 工具执行中：显示带标签的等待提示（如「查询文章列表…」）
              querying = true;
              patchLast({ querying: true, toolLabel: payload.label });
            } else if (event === "status" && payload.stage === "thinking") {
              // 思考模式：正文前先流推理内容，等待期显示「深度思考中」
              querying = true;
              patchLast({ querying: true, thinking: true });
            } else if (event === "tools") {
              patchLast({ tools: Array.isArray(payload) ? (payload as unknown as ToolTrace[]) : [] });
            } else if (event === "delta" && typeof payload.text === "string") {
              gotAny = true;
              if (querying) {
                querying = false;
                patchLast({ querying: false, toolLabel: undefined, thinking: false });
              }
              const safe = moodFilter.feed(payload.text);
              replyText += safe;
              if (safe) appendDelta(safe);
            } else if (event === "error") {
              patchLast({
                content: `${t("chat.errorPrefix")}${payload.message ?? t("chat.unknownError")}`,
                streaming: false,
                querying: false,
                toolLabel: undefined,
                thinking: false,
                failed: !gotAny,
              });
            } else if (event === "done") {
              setMessages((ms) =>
                ms.map((m, i) => {
                  if (i !== ms.length - 1) return m;
                  if (m.content)
                    return { ...m, streaming: false, querying: false, toolLabel: undefined, thinking: false };
                  // done 但一个字都没收到
                  return {
                    ...m,
                    content: t("chat.unknownError"),
                    streaming: false,
                    querying: false,
                    toolLabel: undefined,
                    thinking: false,
                    failed: true,
                  };
                }),
              );
            }
          }
        }
        // 流收尾:吐回被扣留的残缺尾部 + 分发情绪给看板娘(仅 mood 非空时)
        const rest = moodFilter.flush();
        replyText += rest;
        if (rest) appendDelta(rest);
        if (moodFilter.mood) {
          window.dispatchEvent(new CustomEvent("cl-mascot-mood", { detail: { mood: moodFilter.mood } }));
        }
        // 本轮成功:记忆小本本计数(达阈值自动异步提取)
        if (gotAny) noteTurn([...history, { role: "assistant", content: replyText }]);
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
    [t, pathname],
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      trackEvent("use_chat");
      const history = [
        ...messages.filter((m) => !m.failed && !m.streaming),
        { id: uid(), role: "user" as const, content: q },
      ];
      await runTurn(history);
    },
    [busy, messages, runTurn],
  );

  /** 编辑历史提问后重生成：截断该消息之后的一切，改写内容重跑一轮
   *  （历史本就由前端全量携带，服务端无状态，纯前端即可完成） */
  const regenerateFrom = useCallback(
    async (msgId: string, newText: string) => {
      const q = newText.trim();
      if (!q || busy) return;
      const idx = messages.findIndex((m) => m.id === msgId);
      if (idx < 0 || messages[idx]!.role !== "user") return;
      trackEvent("use_chat");
      const history = messages
        .slice(0, idx)
        .filter((m) => !m.failed && !m.streaming);
      await runTurn([...history, { id: uid(), role: "user" as const, content: q }]);
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
    setMessages([{ id: uid(), role: "assistant", content: welcome }]);
    if (persistKey) {
      try {
        localStorage.removeItem(persistKey);
      } catch {}
    }
  }, [welcome, persistKey]);

  return { messages, busy, send, retry, stop, clear, regenerateFrom };
}
