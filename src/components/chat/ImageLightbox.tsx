"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";

/**
 * 聊天图片灯箱：全屏暗色虚化层 + 大图居中。
 * 多图时左右切换（←/→ 键同样生效），点空白、✕ 或 Esc 关闭。
 * dataURL 图片无法用"新标签页打开"，所以用站内灯箱承载放大查看。
 */
export interface LightboxState {
  srcs: string[];
  index: number;
}

export function ImageLightbox({
  state,
  onClose,
  onNav,
}: {
  state: LightboxState;
  onClose: () => void;
  onNav: (index: number) => void;
}) {
  const t = useT();
  const total = state.srcs.length;
  const current = state.srcs[state.index] ?? "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && state.index > 0) onNav(state.index - 1);
      else if (e.key === "ArrowRight" && state.index < total - 1) onNav(state.index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.index, total, onClose, onNav]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label={t("chat.imageViewer")}
    >
      {/* 关闭 */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t("chat.closeAria")}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/90 transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {/* 计数 */}
      {total > 1 && (
        <span className="absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
          {state.index + 1} / {total}
        </span>
      )}
      {/* 大图（点击自身不关闭，方便细看） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
      />
      {/* 前后切换 */}
      {state.index > 0 && (
        <button
          type="button"
          aria-label={t("chat.prevImage")}
          onClick={(e) => {
            e.stopPropagation();
            onNav(state.index - 1);
          }}
          className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/90 transition-colors hover:bg-white/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {state.index < total - 1 && (
        <button
          type="button"
          aria-label={t("chat.nextImage")}
          onClick={(e) => {
            e.stopPropagation();
            onNav(state.index + 1);
          }}
          className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/90 transition-colors hover:bg-white/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
