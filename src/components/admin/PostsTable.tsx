"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Pin, PinOff, Eye, EyeOff, Trash2, Pencil, Plus, Upload, FolderDown, X } from "lucide-react";
import {
  deletePost,
  importMarkdownFiles,
  importMarkdownFromContentDir,
  setPostStatus,
  togglePostPin,
} from "@/app/admin/actions/posts";
import type { ImportResult } from "@/lib/content/import-markdown";
import { formatDateTime } from "@/lib/shared/utils";

export interface AdminPostRow {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published" | "scheduled";
  isPinned: boolean;
  views: number;
  likes: number;
  wordCount: number;
  updatedAt: Date;
  publishedAt: Date | null;
  categoryName: string | null;
}

export function PostsTable({ rows }: { rows: AdminPostRow[] }) {
  const [pending, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 上传 .md 文件导入：前端读文本，gray-matter 在服务端解析 */
  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImporting(true);
    setImportResults(null);
    try {
      const texts = await Promise.all(
        Array.from(files)
          .filter((f) => /\.md$/i.test(f.name))
          .map(async (f) => ({ name: f.name, text: await f.text() })),
      );
      setImportResults(await importMarkdownFiles(texts));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onImportDir = async () => {
    setImporting(true);
    setImportResults(null);
    try {
      setImportResults(await importMarkdownFromContentDir());
    } finally {
      setImporting(false);
    }
  };

  const created = importResults?.filter((r) => r.outcome === "created").length ?? 0;
  const updated = importResults?.filter((r) => r.outcome === "updated").length ?? 0;
  const failed = importResults?.filter((r) => r.outcome === "error") ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold">全部文章（{rows.length}）</h2>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md,.markdown"
            className="hidden"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="上传本地 .md 文件（front-matter 约定见 content/posts 示例）"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? "导入中…" : "导入 .md"}
          </button>
          <button
            onClick={() => void onImportDir()}
            disabled={importing}
            title="一键导入服务器 content/posts/ 目录下的全部文章（按 slug 幂等，重复点击安全）"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
          >
            <FolderDown className="h-3.5 w-3.5" />
            从内容目录导入
          </button>
          <Link
            href="/admin/posts/new"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            新文章
          </Link>
        </div>
      </div>

      {importResults && (
        <div className="border-b border-slate-100 bg-indigo-50/50 px-5 py-3 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <p>
              导入完成：新建 <b className="text-indigo-600">{created}</b> 篇 · 更新{" "}
              <b className="text-emerald-600">{updated}</b> 篇
              {failed.length > 0 && (
                <>
                  {" "}
                  · 失败 <b className="text-rose-600">{failed.length}</b> 篇
                </>
              )}
            </p>
            <button onClick={() => setImportResults(null)} className="rounded p-0.5 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {failed.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-rose-500">
              {failed.map((r) => (
                <li key={r.file}>
                  {r.file}
                  {r.note ? `：${r.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows.length ? (
        <ul className="divide-y divide-slate-100">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                  p.status === "published"
                    ? "bg-emerald-50 text-emerald-600"
                    : p.status === "scheduled"
                      ? "bg-sky-50 text-sky-600"
                      : "bg-amber-50 text-amber-600"
                }`}
              >
                {p.status === "published"
                  ? "已发布"
                  : p.status === "scheduled"
                    ? `定时 · ${p.publishedAt ? formatDateTime(p.publishedAt) : "—"}`
                    : "草稿"}
              </span>
              {p.isPinned && (
                <Pin className="h-3.5 w-3.5 shrink-0 rotate-45 text-amber-500" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
              <span className="hidden shrink-0 text-xs text-slate-400 md:inline">
                {p.categoryName ?? "未分类"} · {p.wordCount} 字 · {p.views} 阅读 · {p.likes} 赞
              </span>
              <span className="hidden shrink-0 text-xs text-slate-400 lg:inline">
                {formatDateTime(p.updatedAt)}
              </span>
              <span className={`flex shrink-0 items-center gap-1 ${pending ? "opacity-50" : ""}`}>
                <button
                  title={p.isPinned ? "取消置顶" : "置顶"}
                  onClick={() => startTransition(() => togglePostPin(p.id))}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-500"
                >
                  {p.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button
                  title={p.status === "published" ? "转为草稿" : p.status === "scheduled" ? "立即发布" : "发布"}
                  onClick={() =>
                    startTransition(() =>
                      setPostStatus(p.id, p.status === "published" ? "draft" : "published"),
                    )
                  }
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-500"
                >
                  {p.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <Link
                  href={`/admin/posts/${p.id}`}
                  title="编辑"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-500"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  title="删除"
                  onClick={() => {
                    if (confirm(`确定删除「${p.title}」？此操作不可恢复。`)) {
                      startTransition(() => deletePost(p.id));
                    }
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-slate-400">
          还没有文章 · 点击右上角「新文章」开始
        </p>
      )}
    </div>
  );
}
