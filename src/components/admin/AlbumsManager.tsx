"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, X, Check, Images } from "lucide-react";
import { saveAlbum, deleteAlbum } from "@/app/admin/actions";

interface AlbumRow {
  id: number;
  title: string;
  description: string;
  cover: string;
  photoCount: number;
}

const EMPTY: Omit<AlbumRow, "photoCount"> = { id: 0, title: "", description: "", cover: "" };

export function AlbumsManager({ albums }: { albums: AlbumRow[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Omit<AlbumRow, "photoCount"> | null>(null);
  const set = (patch: Partial<Omit<AlbumRow, "photoCount">>) =>
    setForm((f) => (f ? { ...f, ...patch } : f));

  const submit = () => {
    if (!form || !form.title.trim()) return;
    startTransition(() => {
      saveAlbum({ ...form, id: form.id || undefined });
      setForm(null);
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex justify-end">
        {form ? (
          <span className="flex items-center gap-2 text-sm text-slate-500">
            {form.id ? "编辑相册" : "新建相册"}
            <button onClick={() => setForm(null)} className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
              <X className="h-3.5 w-3.5" /> 取消
            </button>
          </span>
        ) : (
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> 新建相册
          </button>
        )}
      </div>

      {form && (
        <div className="mb-6 grid gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">标题</span>
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">封面 URL</span>
            <input value={form.cover} onChange={(e) => set({ cover: e.target.value })} placeholder="留空用第一张照片" className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-slate-500">简介</span>
            <input value={form.description} onChange={(e) => set({ description: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </label>
          <div className="sm:col-span-2">
            <button onClick={submit} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs font-medium text-white">
              <Check className="h-3.5 w-3.5" /> 保存
            </button>
          </div>
        </div>
      )}

      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
        {albums.map((a) => (
          <div key={a.id} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
            <Link href={`/admin/albums/${a.id}`} className="relative block aspect-[16/9] bg-gradient-to-br from-indigo-100 to-purple-100">
              {a.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.cover} alt={a.title} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-slate-300">
                  <Images className="h-10 w-10" />
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="text-xs text-slate-400">{a.photoCount} 张照片</p>
              </div>
              <button onClick={() => setForm({ id: a.id, title: a.title, description: a.description, cover: a.cover })} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500" title="编辑">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => confirm(`删除相册「${a.title}」及其全部照片？`) && startTransition(() => deleteAlbum(a.id))}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                title="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {!albums.length && (
          <p className="col-span-full rounded-2xl border border-slate-200/80 bg-white px-5 py-10 text-center text-sm text-slate-400">
            还没有相册
          </p>
        )}
      </div>
    </div>
  );
}
