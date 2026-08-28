"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, X, Check, ExternalLink } from "lucide-react";
import { saveFriend, deleteFriend } from "@/app/admin/actions";
import { UploadButton } from "@/components/admin/UploadButton";

interface FriendRow {
  id: number;
  name: string;
  url: string;
  avatar: string;
  description: string;
  sort: number;
}

const EMPTY: FriendRow = { id: 0, name: "", url: "", avatar: "", description: "", sort: 0 };

export function FriendsManager({ friends }: { friends: FriendRow[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FriendRow | null>(null);
  const set = <K extends keyof FriendRow>(k: K, v: FriendRow[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const submit = () => {
    if (!form || !form.name.trim() || !form.url.trim()) return;
    startTransition(() => {
      saveFriend({ ...form, id: form.id || undefined });
      setForm(null);
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end">
        {form ? (
          <span className="flex items-center gap-2 text-sm text-slate-500">
            {form.id ? "编辑友链" : "添加友链"}
            <button onClick={() => setForm(null)} className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
              <X className="h-3.5 w-3.5" /> 取消
            </button>
          </span>
        ) : (
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> 添加友链
          </button>
        )}
      </div>

      {/* 表单 */}
      {form && (
        <div className="mb-6 grid gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">名称</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">链接</span>
            <input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">头像</span>
            <div className="flex items-center gap-2">
              <input value={form.avatar} onChange={(e) => set("avatar", e.target.value)} placeholder="/uploads/... 或 https://..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400" />
              <UploadButton onUploaded={([url]) => set("avatar", url)} label="上传" />
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">排序（小的在前）</span>
            <input type="number" value={form.sort} onChange={(e) => set("sort", Number(e.target.value))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-slate-500">简介</span>
            <input value={form.description} onChange={(e) => set("description", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </label>
          <div className="sm:col-span-2">
            <button onClick={submit} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs font-medium text-white">
              <Check className="h-3.5 w-3.5" /> 保存
            </button>
          </div>
        </div>
      )}

      <ul className={`divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-sm ${pending ? "opacity-60" : ""}`}>
        {friends.map((f) => (
          <li key={f.id} className="group flex items-center gap-3 px-5 py-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.avatar} alt={f.name} className="h-10 w-10 shrink-0 rounded-full ring-2 ring-slate-100" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {f.name}
                <a href={f.url} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-indigo-400">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </p>
              <p className="truncate text-xs text-slate-400">{f.description}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">#{f.sort}</span>
            <button onClick={() => setForm(f)} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500" title="编辑">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => confirm(`删除友链「${f.name}」？`) && startTransition(() => deleteFriend(f.id))}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {!friends.length && <li className="px-5 py-8 text-center text-sm text-slate-400">暂无友链</li>}
      </ul>
    </div>
  );
}
