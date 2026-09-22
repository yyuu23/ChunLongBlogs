"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";

const MIN_CHARS = 8;

/**
 * 划词问 AI（文章页）：正文里选中 ≥8 字 → 选区上方浮现"问猫这段"浮条 →
 * 点击唤起文章页内联伴读面板（cl-open-article-chat）并预填
 * "关于《文章》里这段：「引文」——"（模板可能要改，不自动发）。
 * 选区与文章上下文由 AI 侧的 articleSlug 全文注入兜底。滚轮/resize/短选区隐藏。
 */
export function ArticleSelectionAsk({ title }: { title: string }) {
  const t = useT();
  const [bar, setBar] = useState<{ top: number; left: number } | null>(null);
  const quoteRef = useRef("");

  useEffect(() => {
    const root = document.querySelector("[data-cl-article] .md");
    if (!root) return;

    let lastCheck = 0;
    const check = () => {
      const now = performance.now();
      if (now - lastCheck < 200) return; // selectionchange 高频，节流
      lastCheck = now;
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || sel.isCollapsed || text.length < MIN_CHARS || !sel.anchorNode || !root.contains(sel.anchorNode)) {
        setBar(null);
        return;
      }
      const range = sel.getRangeAt(0).getBoundingClientRect();
      if (!range.width && !range.height) {
        setBar(null);
        return;
      }
      quoteRef.current = text;
      setBar({
        top: Math.max(8, range.top - 44),
        left: Math.max(8, Math.min(range.left + range.width / 2 - 70, window.innerWidth - 156)),
      });
    };

    const onSelectionChange = () => check();
    const hide = () => setBar(null);
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
    };
  }, []);

  const ask = () => {
    const quote = quoteRef.current.slice(0, 200);
    if (!quote) return;
    setBar(null);
    window.getSelection()?.removeAllRanges();
    window.dispatchEvent(
      new CustomEvent("cl-open-article-chat", {
        detail: { prefill: t("posts.askQuoteTemplate", { title, quote }) },
      }),
    );
  };

  if (!bar) return null;
  return (
    <button
      type="button"
      onClick={ask}
      style={{ position: "fixed", top: bar.top, left: bar.left }}
      className="glass-card z-30 flex items-center gap-1.5 !rounded-full px-3 py-1.5 text-xs text-accent shadow-lg"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {t("posts.askAboutSelection")}
    </button>
  );
}
