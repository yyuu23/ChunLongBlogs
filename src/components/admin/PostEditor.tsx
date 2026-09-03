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
  Check,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Wand2,
  Undo2,
} from "lucide-react";
import { savePost } from "@/app/admin/actions";
import { UploadButton } from "@/components/admin/UploadButton";
import { AutoCover } from "@/components/posts/AutoCover";
import { LazyImage } from "@/components/effects/Typewriter";
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

/** 字段级"确定覆盖 / 取消"内联确认按钮组：摘要 / 标题 / slug 三处共用 */
function OverwriteConfirm({
  hint,
  onConfirm,
  onCancel,
}: {
  hint: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-[11px] text-amber-600">{hint}</span>
      <button
        type="button"
        onClick={onConfirm}
        className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 transition-colors hover:bg-amber-100"
      >
        <Check className="h-3 w-3" />
        确定覆盖
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-200"
      >
        <X className="h-3 w-3" />
        取消
      </button>
    </span>
  );
}

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
  const [aiTitling, setAiTitling] = useState(false);
  const [aiSlugging, setAiSlugging] = useState(false);
  const [polishing, setPolishing] = useState(false);
  /** 润色前的正文备份：null = 未润色过；再次润色会刷新备份（撤销只有一级） */
  const [polishBackup, setPolishBackup] = useState<string | null>(null);
  /** 字段已有内容时，对应按钮原地切换成"确定覆盖 / 取消"的内联确认态 */
  const [confirmField, setConfirmField] = useState<null | "summary" | "title" | "slug">(null);
  const [aiTagging, setAiTagging] = useState(false);
  /** AI 生成的标签建议词条，点击添加后才进 tagNames */
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
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

  /** 入口：正文太短直接提示；摘要已有内容时先原地切换成"确定覆盖 / 取消"，不用原生 confirm */
  const aiSummarize = () => {
    if (data.content.trim().length < 20) {
      setMessage({ type: "err", text: "正文太短，先写点内容再生成摘要" });
      return;
    }
    if (data.description.trim()) {
      setConfirmField("summary");
      return;
    }
    void runAiSummarize();
  };

  /** 让 AI 根据标题+正文写摘要，成功后直接填入摘要框 */
  const runAiSummarize = async () => {
    setConfirmField(null);
    setAiSummarizing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, content: data.content }),
        signal: AbortSignal.timeout(35_000),
      });
      const json = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok || !json.summary) {
        setMessage({ type: "err", text: json.error ?? "生成失败，请重试" });
        return;
      }
      set("description", json.summary);
      setMessage({ type: "ok", text: "摘要已生成 ✓" });
    } catch (e) {
      setMessage({
        type: "err",
        text:
          e instanceof DOMException && e.name === "TimeoutError"
            ? "AI 响应超时，请重试"
            : "生成失败，请检查网络",
      });
    } finally {
      setAiSummarizing(false);
    }
  };

  /** AI 起标题：正文先行时很常用；空标题直接填入，有标题先确认 */
  const aiGenerateTitle = () => {
    if (data.content.trim().length < 20) {
      setMessage({ type: "err", text: "正文太短，先写点内容再生成标题" });
      return;
    }
    if (data.title.trim()) {
      setConfirmField("title");
      return;
    }
    void runAiTitle();
  };

  const runAiTitle = async () => {
    setConfirmField(null);
    setAiTitling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/suggest-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: data.content }),
        signal: AbortSignal.timeout(35_000),
      });
      const json = (await res.json()) as { title?: string; error?: string };
      if (!res.ok || !json.title) {
        setMessage({ type: "err", text: json.error ?? "生成失败，请重试" });
        return;
      }
      set("title", json.title);
      // 与手输标题同款联动：新文章且 slug 仍是旧标题的自动值时跟随更新
      if (!data.id && (!data.slug || data.slug === slugify(data.title))) {
        set("slug", slugify(json.title));
      }
      setMessage({ type: "ok", text: "标题已生成 ✓" });
    } catch (e) {
      setMessage({
        type: "err",
        text:
          e instanceof DOMException && e.name === "TimeoutError"
            ? "AI 响应超时，请重试"
            : "生成失败，请检查网络",
      });
    } finally {
      setAiTitling(false);
    }
  };

  /** AI 生成英文 slug：中文标题 slugify 后仍是中文，AI 能概括出体面的英文短 slug */
  const aiGenerateSlug = () => {
    if (!data.title.trim() && data.content.trim().length < 20) {
      setMessage({ type: "err", text: "先写标题或正文再生成 slug" });
      return;
    }
    if (data.slug.trim()) {
      setConfirmField("slug");
      return;
    }
    void runAiSlug();
  };

  const runAiSlug = async () => {
    setConfirmField(null);
    setAiSlugging(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/suggest-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, content: data.content }),
        signal: AbortSignal.timeout(35_000),
      });
      const json = (await res.json()) as { slug?: string; error?: string };
      if (!res.ok || !json.slug) {
        setMessage({ type: "err", text: json.error ?? "生成失败，请重试" });
        return;
      }
      set("slug", json.slug);
      setMessage({ type: "ok", text: "slug 已生成 ✓" });
    } catch (e) {
      setMessage({
        type: "err",
        text:
          e instanceof DOMException && e.name === "TimeoutError"
            ? "AI 响应超时，请重试"
            : "生成失败，请检查网络",
      });
    } finally {
      setAiSlugging(false);
    }
  };

  /** AI 润色整篇正文：基于原文重写（保原意与代码，优化结构、格式与表达），润色前原文可一键撤销 */
  const aiPolish = async () => {
    if (data.content.trim().length < 20) {
      setMessage({ type: "err", text: "正文太短，先写点内容再润色" });
      return;
    }
    setPolishing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "post", title: data.title, content: data.content }),
        // 长文生成耗时明显，客户端超时放宽到 2 分钟（接口侧 90 秒）
        signal: AbortSignal.timeout(120_000),
      });
      const json = (await res.json()) as { content?: string; error?: string };
      if (!res.ok || !json.content) {
        setMessage({ type: "err", text: json.error ?? "润色失败，请重试" });
        return;
      }
      setPolishBackup(data.content);
      set("content", json.content);
      setMessage({ type: "ok", text: "已润色 ✓（不满意可点工具栏「撤销润色」恢复原文）" });
    } catch (e) {
      setMessage({
        type: "err",
        text:
          e instanceof DOMException && e.name === "TimeoutError"
            ? "AI 润色超时，请重试"
            : "润色失败，请检查网络",
      });
    } finally {
      setPolishing(false);
    }
  };

  const undoPolish = () => {
    if (polishBackup == null) return;
    set("content", polishBackup);
    setPolishBackup(null);
    setMessage({ type: "ok", text: "已撤销润色，恢复原文 ✓" });
  };

  /** AI 依据标题+正文生成标签建议：显示为翠绿词条点击添加，不动已有标签 */
  const aiSuggestTags = async () => {
    if (data.content.trim().length < 20) {
      setMessage({ type: "err", text: "正文太短，先写点内容再生成标签" });
      return;
    }
    setAiTagging(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, content: data.content }),
        signal: AbortSignal.timeout(35_000),
      });
      const json = (await res.json()) as { tags?: string[]; error?: string };
      if (!res.ok || !json.tags) {
        setMessage({ type: "err", text: json.error ?? "生成失败，请重试" });
        return;
      }
      const fresh = json.tags.filter((t) => !data.tagNames.includes(t));
      setTagSuggestions(fresh);
      setMessage(
        fresh.length
          ? { type: "ok", text: `AI 建议了 ${fresh.length} 个标签，点击词条添加` }
          : { type: "ok", text: "AI 建议的标签都已存在，无需添加" },
      );
    } catch (e) {
      setMessage({
        type: "err",
        text:
          e instanceof DOMException && e.name === "TimeoutError"
            ? "AI 响应超时，请重试"
            : "生成失败，请检查网络",
      });
    } finally {
      setAiTagging(false);
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
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">标题</span>
            {confirmField === "title" ? (
              <OverwriteConfirm
                hint="生成将覆盖现有标题"
                onConfirm={() => void runAiTitle()}
                onCancel={() => setConfirmField(null)}
              />
            ) : (
              <button
                type="button"
                onClick={aiGenerateTitle}
                disabled={aiTitling}
                title="用 AI 根据正文拟一个标题"
                className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-60"
              >
                {aiTitling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {aiTitling ? "生成中…" : "AI 起标题"}
              </button>
            )}
          </div>
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
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">链接 slug（用于 URL）</span>
            {confirmField === "slug" ? (
              <OverwriteConfirm
                hint="生成将覆盖现有 slug"
                onConfirm={() => void runAiSlug()}
                onCancel={() => setConfirmField(null)}
              />
            ) : (
              <button
                type="button"
                onClick={aiGenerateSlug}
                disabled={aiSlugging}
                title="用 AI 根据标题与正文生成英文 URL slug"
                className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-60"
              >
                {aiSlugging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {aiSlugging ? "生成中…" : "AI 生成 slug"}
              </button>
            )}
          </div>
          <input
            value={data.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="auto-generated"
            className="rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-xs outline-none transition-colors focus:border-indigo-400"
          />
        </div>

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
            {confirmField === "summary" ? (
              <OverwriteConfirm
                hint="生成结果将覆盖现有摘要"
                onConfirm={() => void runAiSummarize()}
                onCancel={() => setConfirmField(null)}
              />
            ) : (
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
            )}
          </div>
          <textarea
            value={data.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="留空则自动截取正文"
            rows={2}
            className="resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400"
          />
          <span
            className={`text-[11px] ${
              data.description.length > 160 ? "text-amber-500" : "text-slate-400"
            }`}
          >
            {data.description.length} 字
            {data.description.length > 160 ? " · 超过 160 字，搜索与分享卡的摘要可能被截断" : ""}
          </span>
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
          {/* 封面预览：有地址看加载结果（失败有提示），没地址直接预览自动渐变封面 */}
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-100">
            {data.cover ? (
              <LazyImage
                src={data.cover}
                alt="封面预览"
                fill
                sizes="320px"
                className="object-cover"
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50 px-4 text-center text-[11px] text-slate-400">
                    封面地址加载失败；发布后前台会自动降级为渐变封面
                  </div>
                }
              />
            ) : (
              <AutoCover title={data.title || "未命名文章"} seed={data.slug} variant="wide" />
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            {data.cover
              ? "分享卡（微信/QQ/Twitter）将使用这张封面图"
              : "未设置封面时，前台与分享卡会按 slug 自动生成渐变封面"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">标签（回车添加）</span>
            <button
              type="button"
              onClick={aiSuggestTags}
              disabled={aiTagging}
              title="用 AI 根据标题与正文生成标签建议，优先复用标签库中已有的标签"
              className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-60"
            >
              {aiTagging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {aiTagging ? "生成中…" : "AI 生成标签"}
            </button>
          </div>
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
          {tagSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-emerald-600">AI 建议：</span>
              {tagSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    addTag(s);
                    setTagSuggestions((list) => list.filter((x) => x !== s));
                  }}
                  className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-600 transition-colors hover:bg-emerald-100"
                >
                  + {s}
                </button>
              ))}
              {tagSuggestions.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    // 直接合并数组而不是循环调 addTag：后者基于同一快照计算，连续调用会互相覆盖
                    const adding = tagSuggestions.filter((t) => !data.tagNames.includes(t));
                    set("tagNames", [...data.tagNames, ...adding]);
                    setTagSuggestions([]);
                  }}
                  className="rounded-full border border-emerald-200 px-2.5 py-0.5 text-[11px] text-emerald-600 transition-colors hover:bg-emerald-50"
                >
                  全部添加
                </button>
              )}
            </div>
          )}
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
            {polishBackup != null && (
              <button
                type="button"
                onClick={undoPolish}
                title="恢复润色前的原文"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-amber-600 transition-colors hover:bg-amber-50"
              >
                <Undo2 className="h-3 w-3" />
                撤销润色
              </button>
            )}
            <button
              type="button"
              onClick={() => void aiPolish()}
              disabled={polishing}
              title="AI 基于当前正文润色：优化结构与格式、保持原意与代码不变，可一键撤销"
              className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-60"
            >
              {polishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              {polishing ? "润色中…" : "AI 润色"}
            </button>
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
