"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Pin, PinOff, Eye, EyeOff, Trash2, Pencil, Plus } from "lucide-react";
import { deletePost, setPostStatus, togglePostPin } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/utils";

export interface AdminPostRow {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  isPinned: boolean;
  views: number;
  wordCount: number;
  updatedAt: Date;
  categoryName: string | null;
}

export function PostsTable({ rows }: { rows: AdminPostRow[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold">全部文章（{rows.length}）</h2>
        <Link
          href="/admin/posts/new"
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          新文章
        </Link>
      </div>

      {rows.length ? (
        <ul className="divide-y divide-slate-100">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                  p.status === "published"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {p.status === "published" ? "已发布" : "草稿"}
              </span>
              {p.isPinned && (
                <Pin className="h-3.5 w-3.5 shrink-0 rotate-45 text-amber-500" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
              <span className="hidden shrink-0 text-xs text-slate-400 md:inline">
                {p.categoryName ?? "未分类"} · {p.wordCount} 字 · {p.views} 阅读
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
                  title={p.status === "published" ? "转为草稿" : "发布"}
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
