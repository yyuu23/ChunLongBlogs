"use client";

import { useRef, useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";

/** 图片上传按钮：上传到 /api/upload 后回调 URL */
export function UploadButton({
  onUploaded,
  label = "上传图片",
  accept = "image/*",
  multiple = false,
  className,
}: {
  onUploaded: (urls: string[]) => void;
  label?: string;
  accept?: string;
  multiple?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (files: FileList) => {
    setBusy(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error ?? "上传失败");
        urls.push(data.url);
      }
      onUploaded(urls);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={
          className ??
          "flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-500 disabled:opacity-60"
        }
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
        {busy ? "上传中…" : label}
      </button>
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />
    </span>
  );
}
