"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ExternalLink, MessageSquareText, Trash2, Undo2 } from "lucide-react";
import { setCommentDeleted } from "@/app/admin/actions";

export interface AdminCommentItem {
  id: number;
  refType: "post" | "moment" | string;
  refId: number;
  content: string;
  ip: string;
  login: string;
  avatarUrl: string;
  date: string;
  deleted: boolean;
  targetTitle: string;
  targetHref: string | null;
}

type Filter = "all" | "post" | "moment" | "deleted";

/** 评论列表：按 全部/文章/说说/已删除 筛选 + 软删除/恢复（server action，完成后刷新） */
export function CommentsManager({ items }: { items: AdminCommentItem[] }) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");

  const deletedCount = items.filter((c) => c.deleted).length;
  const list = items.filter((c) => {
    if (filter === "all") return true;
    if (filter === "deleted") return c.deleted;
    return !c.deleted && c.refType === filter;
  });

  const tabs: Array<{ key: Filter; label: string }> = [
    { key: "all", label: `全部 ${items.length}` },
    { key: "post", label: "文章" },
    { key: "moment", label: "说说" },
    { key: "deleted", label: `已删除 ${deletedCount}` },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-xl px-3 py-1.5 text-xs transition-colors ${
              filter === tab.key
                ? "bg-indigo-500 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          没有符合条件的评论
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((c) => (
            <li
              key={c.id}
              className={`flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 ${
                c.deleted ? "border-slate-200 opacity-60" : "border-slate-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 外链头像小图 */}
              <img
                src={c.avatarUrl}
                alt={c.login}
                referrerPolicy="no-referrer"
                className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <a
                    href={`https://github.com/${c.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-slate-700 hover:text-indigo-500"
                  >
                    {c.login}
                  </a>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                    <MessageSquareText className="mr-0.5 inline h-3 w-3" />
                    {c.refType === "post" ? "文章" : "说说"}
                  </span>
                  {c.targetHref ? (
                    <Link href={c.targetHref} className="flex min-w-0 items-center gap-0.5 text-slate-400 hover:text-indigo-500">
                      <span className="max-w-[14rem] truncate">{c.targetTitle}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-slate-400">{c.targetTitle}</span>
                  )}
                </div>
                <p className={`mt-1 text-sm leading-relaxed ${c.deleted ? "line-through text-slate-400" : ""}`}>
                  {c.content}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  #{c.id} · {c.date}
                  {c.ip && c.ip !== "unknown" && ` · IP ${c.ip}`}
                  {c.deleted && <span className="ml-2 text-rose-400">已删除</span>}
                </p>
              </div>
              {c.deleted ? (
                <button
                  onClick={() => startTransition(() => setCommentDeleted(c.id, false))}
                  disabled={pending}
                  title="恢复"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => startTransition(() => setCommentDeleted(c.id, true))}
                  disabled={pending}
                  title="删除（软删除，可恢复）"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-500 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
