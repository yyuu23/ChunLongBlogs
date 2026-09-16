"use client";

import { Check, X } from "lucide-react";

export function OverwriteConfirm({
  hint,
  onConfirm,
  onCancel,
}: {
  hint: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-[11px] text-amber-600">{hint}</span>
      <button
        type="button"
        onClick={onConfirm}
        className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 transition-colors hover:bg-amber-100"
      >
        <Check className="h-3 w-3" />
        确定覆盖
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-200"
      >
        <X className="h-3 w-3" />
        取消
      </button>
    </span>
  );
}
