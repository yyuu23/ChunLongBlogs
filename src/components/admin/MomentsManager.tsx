"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, X, Loader2, MapPin } from "lucide-react";
import { saveMoment, deleteMoment } from "@/app/admin/actions";
import { UploadButton } from "@/components/admin/UploadButton";
import { relativeTime } from "@/lib/utils";

interface MomentRow {
  id: number;
  content: string;
  images: string[];
  mood: string;
  location: string;
  createdAt: Date;
}

export function MomentsManager({ moments }: { moments: MomentRow[] }) {
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("💭");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await saveMoment({ content, images, mood, location });
    setContent("");
    setImages([]);
    setMood("💭");
    setLocation("");
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* 发布框 */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="这一刻的想法…"
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400"
        />
        {images.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((src) => (
              <span key={src} className="group relative h-16 w-16 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="配图" className="h-full w-full object-cover" />
                <button
                  onClick={() => setImages(images.filter((i) => i !== src))}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            className="w-16 rounded-xl border border-slate-200 px-2 py-2 text-center text-sm outline-none focus:border-indigo-400"
            title="心情 emoji"
          />
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="位置（可选）"
              className="w-32 bg-transparent text-xs outline-none"
            />
          </div>
          <UploadButton onUploaded={(urls) => setImages((prev) => [...prev, ...urls])} label="添加图片" multiple />
          <button
            onClick={submit}
            disabled={saving || !content.trim()}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            发布
          </button>
        </div>
      </div>

      {/* 时间线 */}
      <ul className={`mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-sm ${pending ? "opacity-60" : ""}`}>
        {moments.map((m) => (
          <li key={m.id} className="group px-5 py-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
              <span>{m.mood || "💭"}</span>
              <span>{relativeTime(m.createdAt)}</span>
              {m.location && <span>· {m.location}</span>}
              <button
                onClick={() => confirm("删除这条说说？") && startTransition(() => deleteMoment(m.id))}
                className="ml-auto rounded-lg p-1 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.content}</p>
            {m.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.images.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="配图" className="h-14 w-14 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </li>
        ))}
        {!moments.length && (
          <li className="px-5 py-8 text-center text-sm text-slate-400">还没有说说</li>
        )}
      </ul>
    </div>
  );
}
