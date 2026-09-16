"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { Copy, CornerDownLeft, Loader2, Replace, Sparkles, Square, Wand2, X } from "lucide-react";
import { ASSIST_ACTION_LABEL, type AssistAction } from "@/lib/ai-assist";

/**
 * 写作助手（选区 AI 工具箱 + 续写），挂在 PostEditor 的编辑器容器内：
 * - 选中 ≥10 字符 → 选区上方浮现工具条（改写/扩写/缩写/翻译/解释/自定义）；
 * - 无选区 → 由编辑器工具栏的「AI 续写」按钮触发（props.exposeContinue 注册回调）；
 * - 结果浮层 SSE 流式实时显示，完成后可替换选区 / 插入选区后 / 复制 / 重新生成；
 * - 落盘一律 view.dispatch（不走受控 value 拼接，避免光标跳动）。
 */

const SELECTION_ACTIONS: AssistAction[] = ["rewrite", "expand", "shorten", "translate_en", "translate_zh", "explain"];
const CONTEXT_CHARS = 500;
const CONTINUE_CHARS = 1500;

interface SelectionInfo {
  from: number;
  to: number;
  text: string;
}

interface PanelState {
  action: AssistAction;
  text: string;
  streaming: boolean;
  error?: string;
  /** 动作发起时的选区/光标（continue 为光标） */
  target: SelectionInfo | { head: number };
}

/** 手工解析 SSE 帧（event/data 两行结构），与前台聊天同一协议风格 */
async function readSSE(res: Response, onEvent: (event: string, data: unknown) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        onEvent(event, JSON.parse(data));
      } catch {}
    }
  }
}

export function AiAssist({
  view,
  title,
  getContent,
  exposeContinue,
}: {
  view: EditorView | null;
  title: string;
  getContent: () => string;
  /** PostEditor 用它把「AI 续写」按钮接进来（工具栏在编辑器外） */
  exposeContinue?: (fn: (() => void) | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selRef = useRef<SelectionInfo | null>(null);
  const [bar, setBar] = useState<{ top: number; left: number } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [copied, setCopied] = useState(false);

  /* 选区监听：动态向 view 追加 updateListener（CM6 appendConfig） */
  useEffect(() => {
    if (!view) return;
    const check = () => {
      const main = view.state.selection.main;
      const text = main.empty ? "" : view.state.doc.sliceString(main.from, main.to);
      const sel: SelectionInfo | null =
        text.trim().length >= 10 ? { from: main.from, to: main.to, text } : null;
      selRef.current = sel;
      if (!sel || panel) {
        setBar(null);
        return;
      }
      // 定位：coordsAtPos 屏幕坐标换算容器相对坐标（preview 模式切走时可能返回 null）
      const pos = view.coordsAtPos(sel.to);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!pos || !rect) {
        setBar(null);
        return;
      }
      setBar({
        top: Math.max(4, pos.top - rect.top - 38),
        left: Math.max(4, Math.min(pos.left - rect.left, rect.width - 260)),
      });
    };
    const ext = EditorView.updateListener.of((u) => {
      if (u.selectionSet || u.docChanged) check();
    });
    view.dispatch({ effects: StateEffect.appendConfig.of(ext) });
    return () => setBar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, panel == null]);

  /* 组件卸载/切换文章时中断在途请求 */
  useEffect(
    () => () => {
      abortRef.current?.abort();
      exposeContinue?.(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const runAssist = useCallback(
    (action: AssistAction) => {
      const view0 = view;
      if (!view0) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let body: Record<string, unknown>;
      let target: PanelState["target"];
      const sel = selRef.current;
      if (action === "continue") {
        const head = view0.state.selection.main.head;
        const doc = getContent();
        const ctx = doc.slice(Math.max(0, head - CONTINUE_CHARS), head);
        if (ctx.trim().length < 20) {
          setPanel({ action, text: "", streaming: false, error: "光标前内容太短，先写点再续写", target: { head } });
          return;
        }
        body = { action, context: ctx, title };
        target = { head };
      } else {
        if (!sel) return;
        const doc = getContent();
        body = {
          action,
          selection: sel.text,
          contextBefore: doc.slice(Math.max(0, sel.from - CONTEXT_CHARS), sel.from),
          contextAfter: doc.slice(sel.to, sel.to + CONTEXT_CHARS),
          title,
          ...(action === "custom" ? { instruction: customText } : {}),
        };
        target = sel;
      }

      setPanel({ action, text: "", streaming: true, target });
      void (async () => {
        try {
          const res = await fetch("/api/admin/assist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) {
            const err = (await res.json().catch(() => null)) as { error?: string } | null;
            setPanel((p) => (p ? { ...p, streaming: false, error: err?.error ?? `请求失败（${res.status}）` } : p));
            return;
          }
          await readSSE(res, (event, data) => {
            const d = data as { text?: string; content?: string; message?: string };
            if (event === "delta" && d.text) {
              setPanel((p) => (p ? { ...p, text: p.text + d.text } : p));
            } else if (event === "done") {
              setPanel((p) => (p ? { ...p, streaming: false } : p));
            } else if (event === "error") {
              setPanel((p) => (p ? { ...p, streaming: false, error: d.message ?? "AI 返回异常" } : p));
            }
          });
          setPanel((p) => (p ? { ...p, streaming: false } : p));
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setPanel((p) => (p ? { ...p, streaming: false, error: e instanceof Error ? e.message : "请求失败" } : p));
        }
      })();
    },
    [view, title, getContent, customText],
  );

  /* 续写按钮注入（编辑器工具栏） */
  useEffect(() => {
    exposeContinue?.(() => runAssist("continue"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAssist]);

  /* 结果落盘：一律 view.dispatch（受控 value 拼接会跳光标） */
  const applyResult = (mode: "replace" | "insert") => {
    if (!view || !panel?.text || panel.streaming) return;
    const t = panel.target;
    const doc = view.state.doc;
    if ("head" in t) {
      const head = Math.min(t.head, doc.length);
      view.dispatch({ changes: { from: head, to: head, insert: panel.text } });
    } else if (t.to <= doc.length && doc.sliceString(t.from, t.to) === t.text) {
      // 选区未变才直接替换/插入，文档变动过则放弃（避免错位覆盖）
      view.dispatch(
        mode === "replace"
          ? { changes: { from: t.from, to: t.to, insert: panel.text } }
          : { changes: { from: t.to, to: t.to, insert: `\n\n${panel.text}` } },
      );
    } else {
      setPanel((p) => (p ? { ...p, error: "生成期间正文已变化，请复制结果手动粘贴" } : p));
      return;
    }
    setPanel(null);
  };

  const copyResult = () => {
    if (!panel?.text) return;
    void navigator.clipboard.writeText(panel.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const btn =
    "rounded-lg px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50";

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      {/* 选区工具条 */}
      {bar && !panel && (
        <div
          className="pointer-events-auto absolute z-20 flex items-center gap-0.5 rounded-xl border border-indigo-100 bg-white px-1.5 py-1 shadow-lg"
          style={{ top: bar.top, left: bar.left }}
        >
          {SELECTION_ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => runAssist(a)}
              className={`${btn} text-indigo-600 hover:bg-indigo-50`}
            >
              {ASSIST_ACTION_LABEL[a]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            className={`${btn} flex items-center gap-1 text-indigo-600 hover:bg-indigo-50`}
          >
            <Wand2 className="h-3 w-3" />
            自定义
          </button>
          {customOpen && (
            <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-slate-100 bg-white p-2 shadow-lg">
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="想对选中文字做什么？（≤500 字）"
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-100 px-2 py-1.5 text-xs focus:border-indigo-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setCustomOpen(false);
                  runAssist("custom");
                }}
                disabled={!customText.trim()}
                className="mt-1.5 w-full rounded-lg bg-indigo-500 py-1 text-[11px] font-medium text-white disabled:opacity-50"
              >
                执行
              </button>
            </div>
          )}
        </div>
      )}

      {/* 结果浮层（编辑器容器右上，不随选区跑） */}
      {panel && (
        <div className="pointer-events-auto absolute right-3 top-3 z-30 flex w-[min(26rem,90%)] flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              AI {ASSIST_ACTION_LABEL[panel.action]}
              {panel.streaming && <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />}
            </span>
            <div className="flex items-center gap-1">
              {panel.streaming ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-rose-500 hover:bg-rose-50"
                >
                  <Square className="h-3 w-3" />
                  停止
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => runAssist(panel.action)}
                  className={`${btn} text-slate-500 hover:bg-slate-50`}
                >
                  重新生成
                </button>
              )}
              <button type="button" onClick={() => setPanel(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-auto px-3.5 py-3">
            {panel.error ? (
              <p className="text-xs leading-relaxed text-rose-500">{panel.error}</p>
            ) : panel.text ? (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{panel.text}</p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" /> 正在生成…
              </p>
            )}
          </div>
          {!panel.streaming && !!panel.text && (
            <div className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-2">
              {"head" in panel.target ? (
                <button
                  type="button"
                  onClick={() => applyResult("insert")}
                  className={`${btn} flex items-center gap-1 bg-indigo-500 text-white hover:bg-indigo-600`}
                >
                  <CornerDownLeft className="h-3 w-3" />
                  插入光标处
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => applyResult("replace")}
                    className={`${btn} flex items-center gap-1 bg-indigo-500 text-white hover:bg-indigo-600`}
                  >
                    <Replace className="h-3 w-3" />
                    替换选区
                  </button>
                  <button type="button" onClick={() => applyResult("insert")} className={`${btn} border border-slate-200 text-slate-600 hover:bg-slate-50`}>
                    插入选区后
                  </button>
                </>
              )}
              <button type="button" onClick={copyResult} className={`${btn} flex items-center gap-1 text-slate-500 hover:bg-slate-50`}>
                <Copy className="h-3 w-3" />
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
