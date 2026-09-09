"use client";

import { useState, useTransition } from "react";
import { Sparkles, Trash2, Undo2 } from "lucide-react";
import { setStarDeleted, setStarFeatured } from "@/app/admin/actions";

export interface AdminStarItem {
  id: number;
  content: string;
  date: string;
  visitor: string;
  featured: boolean;
  deleted: boolean;
}

/** 留声星列表：精选开关 + 软删除/恢复（动作走 server action，完成后整页刷新数据） */
export function StarsManager({ items }: { items: AdminStarItem[] }) {
  const [pending, startTransition] = useTransition();
  const [showDeleted, setShowDeleted] = useState(false);
  const deletedCount = items.filter((s) => s.deleted).length;
  const list = showDeleted ? items : items.filter((s) => !s.deleted);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          共 {items.length} 条
          {deletedCount > 0 && ` · 已删除 ${deletedCount} 条`}
        </span>
        {deletedCount > 0 && (
          <button
            onClick={() => setShowDeleted((v) => !v)}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200"
          >
            {showDeleted ? "隐藏已删除" : "显示已删除"}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          还没有留声星
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((s) => (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 ${
                s.deleted ? "border-slate-200 opacity-60" : "border-slate-200"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${s.deleted ? "line-through" : ""}`}>{s.content}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  #{s.id} · {s.date} · {s.visitor}
                  {s.featured && <span className="ml-2 text-amber-500">✦ 精选</span>}
                  {s.deleted && <span className="ml-2 text-rose-400">已删除</span>}
                </p>
              </div>
              <button
                onClick={() => startTransition(() => setStarFeatured(s.id, !s.featured))}
                disabled={pending || s.deleted}
                title={s.featured ? "取消精选" : "设为精选（前台白金亮星）"}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-30 ${
                  s.featured
                    ? "bg-amber-100 text-amber-500"
                    : "bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-500"
                }`}
              >
                <Sparkles className="h-4 w-4" />
              </button>
              {s.deleted ? (
                <button
                  onClick={() => startTransition(() => setStarDeleted(s.id, false))}
                  disabled={pending}
                  title="恢复"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => startTransition(() => setStarDeleted(s.id, true))}
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
