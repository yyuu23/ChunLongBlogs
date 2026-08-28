"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { saveCategory, deleteCategory, createTag, deleteTag } from "@/app/admin/actions";

interface CategoryRow {
  id: number;
  name: string;
  color: string;
  count: number;
}
interface TagRow {
  id: number;
  name: string;
  count: number;
}

export function CategoriesTagsManager({
  categories,
  tags,
}: {
  categories: CategoryRow[];
  tags: TagRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#6366f1");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [tagName, setTagName] = useState("");

  const submitCategory = () => {
    const name = editing ? editing.name : catName;
    if (!name.trim()) return;
    startTransition(() => {
      void saveCategory({ id: editing?.id, name, color: editing ? editing.color : catColor });
      setEditing(null);
      setCatName("");
    });
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
      {/* 分类 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold">分类</h2>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          {editing ? (
            <>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <input
                type="color"
                value={editing.color}
                onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
                title="颜色"
              />
              <button onClick={submitCategory} className="rounded-lg bg-emerald-50 p-2 text-emerald-600" title="保存">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setEditing(null)} className="rounded-lg bg-slate-100 p-2 text-slate-500" title="取消">
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCategory()}
                placeholder="新分类名称"
                className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
                title="颜色"
              />
              <button
                onClick={submitCategory}
                className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-3.5 py-2 text-xs font-medium text-white"
              >
                <Plus className="h-3.5 w-3.5" /> 添加
              </button>
            </>
          )}
        </div>
        <ul className={`divide-y divide-slate-100 ${pending ? "opacity-60" : ""}`}>
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="flex-1 font-medium">{c.name}</span>
              <span className="text-xs text-slate-400">{c.count} 篇</span>
              <button onClick={() => setEditing(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500" title="编辑">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => confirm(`删除分类「${c.name}」？文章会变为未分类。`) && startTransition(() => deleteCategory(c.id))}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                title="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {!categories.length && <li className="px-5 py-6 text-center text-sm text-slate-400">暂无分类</li>}
        </ul>
      </section>

      {/* 标签 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold">标签</h2>
        <div className="flex gap-2 border-b border-slate-100 px-5 py-3.5">
          <input
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagName.trim()) {
                startTransition(() => {
                  void createTag(tagName);
                });
                setTagName("");
              }
            }}
            placeholder="新标签名称"
            className="w-44 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <button
            onClick={() => {
              if (tagName.trim()) {
                startTransition(() => {
                  void createTag(tagName);
                });
                setTagName("");
              }
            }}
            className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-3.5 py-2 text-xs font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> 添加
          </button>
        </div>
        <div className={`flex flex-wrap gap-2 p-5 ${pending ? "opacity-60" : ""}`}>
          {tags.map((t) => (
            <span
              key={t.id}
              className="group flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600"
            >
              #{t.name}
              <span className="text-slate-400">{t.count}</span>
              <button
                onClick={() => confirm(`删除标签「${t.name}」？`) && startTransition(() => deleteTag(t.id))}
                className="text-slate-300 transition-colors hover:text-rose-500"
                title="删除"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {!tags.length && <p className="w-full py-4 text-center text-sm text-slate-400">暂无标签</p>}
        </div>
      </section>
    </div>
  );
}
