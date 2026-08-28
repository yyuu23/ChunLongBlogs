"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Check, Loader2 } from "lucide-react";
import { addPhotos, updatePhotoCaption, deletePhoto } from "@/app/admin/actions";
import { UploadButton } from "@/components/admin/UploadButton";

interface PhotoRow {
  id: number;
  url: string;
  caption: string;
}

export function PhotosManager({
  albumId,
  albumTitle,
  photos,
}: {
  albumId: number;
  albumTitle: string;
  photos: PhotoRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const handleUploaded = async (urls: string[]) => {
    setUploading(true);
    await addPhotos(albumId, urls);
    setUploading(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/albums" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-indigo-500" title="返回相册列表">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold">{albumTitle}</h1>
          <span className="text-sm text-slate-400">{photos.length} 张</span>
        </div>
        <UploadButton onUploaded={handleUploaded} label="上传照片（可多选）" multiple />
      </header>

      {uploading && (
        <p className="mb-4 flex items-center gap-2 text-sm text-indigo-500">
          <Loader2 className="h-4 w-4 animate-spin" /> 上传中…
        </p>
      )}

      <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
        {photos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption} className="aspect-square w-full object-cover" />
            <div className="flex items-center gap-1.5 p-2">
              <input
                defaultValue={p.caption}
                placeholder=" caption"
                onBlur={(e) => {
                  if (e.target.value !== p.caption) {
                    startTransition(() => updatePhotoCaption(p.id, e.target.value));
                  }
                }}
                className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-xs outline-none transition-colors hover:border-slate-200 focus:border-indigo-300"
              />
              {pending && <Check className="h-3.5 w-3.5 text-emerald-400" />}
              <button
                onClick={() => confirm("删除这张照片？") && startTransition(() => deletePhoto(p.id))}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {!photos.length && (
          <p className="col-span-full rounded-2xl border border-slate-200/80 bg-white px-5 py-12 text-center text-sm text-slate-400">
            还没有照片，点击右上角上传
          </p>
        )}
      </div>
    </div>
  );
}
