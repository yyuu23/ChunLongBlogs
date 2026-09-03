"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { markdown as markdownLang } from "@codemirror/lang-markdown";
import {
  Save,
  Loader2,
  ImagePlus,
  FileEdit,
  Columns2,
  BookOpen,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { savePost } from "@/app/admin/actions";
import { UploadButton } from "@/components/admin/UploadButton";
import { countWords, slugify } from "@/lib/utils";

export interface EditorPostData {
  id?: number;
  title: string;
  slug: string;
  description: string;
  content: string;
  cover: string;
  categoryId: number | null;
  tagNames: string[];
  status: "draft" | "published";
  isPinned: boolean;
}

type Mode = "edit" | "split" | "preview";

export function PostEditor({
  initial,
  categories,
  allTags,
}: {
  initial: EditorPostData;
  categories: { id: number; name: string }[];
  allTags: string[];
}) {
  const router = useRouter();
  const [data, setData] = useState<EditorPostData>(initial);
  const [mode, setMode] = useState<Mode>("split");
  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [aiSummarizing, setAiSummarizing] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const words = useMemo(() => countWords(data.content), [data.content]);

  const set = <K extends keyof EditorPostData>(key: K, value: EditorPostData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  // 防抖请求服务端渲染预览（与前台同一管线）
  useEffect(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: data.content }),
        });
        const json = (await res.json()) as { html?: string };
        setPreviewHtml(json.html ?? "");
      } catch {}
    }, 500);
    return () => clearTimeout(previewTimer.current);
  }, [data.content]);

  const addTag = (name: string) => {
    const trimmed = name.trim().replace(/^#/, "");
    if (!trimmed || data.tagNames.includes(trimmed)) return;
    set("tagNames", [...data.tagNames, trimmed]);
    setTagInput("");
  };

  /** 让 AI 根据标题+正文写摘要，成功后直接填入摘要框（覆盖前先确认） */
  const aiSummarize = async () => {
    if (data.content.trim().length < 20) {
      setMessage({ type: "err", text: "正文太短，先写点内容再生成摘要" });
      return;
    }
    if (data.description.trim() && !confirm("摘要已有内容，生成的结果会覆盖它，继续？")) return;
    setAiSummarizing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, content: data.content }),
      });
      const json = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok || !json.summary) {
        setMessage({ type: "err", text: json.error ?? "生成失败，请重试" });
        return;
      }
      set("description", json.summary);
      setMessage({ type: "ok", text: "摘要已生成 ✓" });
    } catch {
      setMessage({ type: "err", text: "生成失败，请检查网络" });
    } finally {
      setAiSummarizing(false);
    }
  };

  const insertAtCursor = (text: string) => {
    set("content", `${data.content}\n\n![图片](${text})\n`);
  };

  const save = async (status: "draft" | "published") => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await savePost({ ...data, status });
      if ("error" in result && result.error) {
        setMessage({ type: "err", text: result.error });
        return;
      }
      if ("ok" in result) {
        set("status", status);
        setMessage({ type: "ok", text: status === "published" ? "已发布 ✓" : "草稿已保存 ✓" });
        setTimeout(() => router.push("/admin/posts"), 600);
      }
    } catch {
      setMessage({ type: "err", text: "保存失败，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const suggestions = allTags.filter(
    (t) => !data.tagNames.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{data.id ? "编辑文章" : "写文章"}</h1>
        <div className="flex items-center gap-2">
          {message && (
            <span
              className={`flex items-center gap-1.5 text-xs ${
                message.type === "ok" ? "text-emerald-600" : "text-rose-500"
              }`}
            >
              {message.type === "ok" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {message.text}
            </span>
          )}
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-500 disabled:opacity-60"
          >
            存草稿
          </button>
          <button
            onClick={() => save("published")}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {data.status === "published" ? "更新" : "发布"}
          </button>
        </div>
      </header>

      {/* 元信息 */}
      <div className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-medium text-slate-500">标题</span>
          <input
            value={data.title}
            onChange={(e) => {
              set("title", e.target.value);
              if (!data.id && (!data.slug || data.slug === slugify(data.title))) {
                set("slug", slugify(e.target.value));
              }
            }}
            placeholder="文章标题"
            className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">链接 slug（用于 URL）</span>
          <input
            value={data.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="auto-generated"
            className="rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs outline-none transition-colors focus:border-indigo-400"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">分类</span>
          <select
            value={data.categoryId ?? ""}
            onChange={(e) => set("categoryId", e.target.value ? Number(e.target.value) : null)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400"
          >
            <option value="">未分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">摘要</span>
            <button
              type="button"
              onClick={aiSummarize}
              disabled={aiSummarizing}
              title="用 AI 根据标题与正文生成一句话摘要"
              className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-60"
            >
              {aiSummarizing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {aiSummarizing ? "生成中…" : "AI 生成摘要"}
            </button>
          </div>
          <textarea
            value={data.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="留空则自动截取正文"
            rows={2}
            className="resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">封面图</span>
          <div className="flex items-center gap-2">
            <input
              value={data.cover}
              onChange={(e) => set("cover", e.target.value)}
              placeholder="/assets/... 或 https://..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition-colors focus:border-indigo-400"
            />
            <UploadButton onUploaded={([url]) => set("cover", url)} label="上传" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">标签（回车添加）</span>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2">
            {data.tagNames.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-600"
              >
                #{t}
                <button onClick={() => set("tagNames", data.tagNames.filter((x) => x !== t))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder="输入标签"
              className="min-w-24 flex-1 bg-transparent py-0.5 text-xs outline-none"
            />
          </div>
          {tagInput && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s}
                  onClick={() => addTag(s)}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  #{s}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.isPinned}
            onChange={(e) => set("isPinned", e.target.checked)}
            className="h-4 w-4 accent-indigo-500"
          />
          <span className="text-sm text-slate-600">置顶</span>
        </label>
      </div>

      {/* 编辑器 */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-1">
            {(
              [
                ["edit", "编辑", FileEdit],
                ["split", "分栏", Columns2],
                ["preview", "预览", BookOpen],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  mode === m ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{words} 字</span>
            <UploadButton onUploaded={(urls) => urls.forEach(insertAtCursor)} label="插入图片" />
          </div>
        </div>

        <div className={`grid ${mode === "split" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          {mode !== "preview" && (
            <div className="min-h-[28rem] border-slate-100 lg:border-r">
              <CodeMirror
                value={data.content}
                height="28rem"
                extensions={[markdownLang(), EditorView.lineWrapping]}
                onChange={(v) => set("content", v)}
                basicSetup={{ foldGutter: false, highlightActiveLine: false }}
                placeholder="用 Markdown 写点什么…"
                className="text-sm"
              />
            </div>
          )}
          {mode !== "edit" && (
            <div className="min-h-[28rem] bg-slate-50/50 px-6 py-5">
              <div className="md" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
