"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, CornerDownLeft } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { trackEvent } from "@/lib/track";

interface Hit {
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
}

/** 命中关键词高亮（大小写不敏感），关键词里的正则元字符要转义 */
function Highlight({ text, kw }: { text: string; kw: string }) {
  const q = kw.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(
    new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
  );
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded bg-accent-soft px-0.5 text-accent">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

/**
 * 全站搜索命令面板：⌘K / Ctrl+K 打开，↑↓ 选中，Enter 打开，Esc 关闭。
 * 复用现成的 /api/search（SQL LIKE，中文 2 字关键词也能命中）。
 * 由 Navbar 通过 window 事件 "cl-open-search" 也可唤起。
 */
export function SearchPalette() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
    setActive(0);
  }, []);

  // ⌘K / Ctrl+K 开关 + Navbar 点击唤起
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cl-open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cl-open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      trackEvent("use_search");
      // 等入场动画挂上 DOM 再聚焦
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [open]);

  // 输入 debounce 250ms；请求乱序返回时以最后一次输入为准
  useEffect(() => {
    if (!open) return;
    const kw = q.trim();
    if (!kw) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const id = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(kw)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: Hit[] }) => {
          if (cancelled) return;
          setHits(d.items ?? []);
          setActive(0);
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, open]);

  const go = useCallback(
    (hit: Hit) => {
      close();
      router.push(`/posts/${hit.slug}`);
    },
    [close, router],
  );

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (hits.length ? (i + 1) % hits.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (hits.length ? (i - 1 + hits.length) % hits.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) go(hit);
      else if (q.trim()) {
        close();
        router.push(`/posts?q=${encodeURIComponent(q.trim())}`);
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("search.title")}
            className="fixed inset-x-0 top-[12vh] z-[91] mx-auto w-[min(94%,36rem)]"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="glass-card overflow-hidden">
              <label className="flex items-center gap-2.5 border-b border-[var(--glass-border)] px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-muted" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder={t("search.placeholder")}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted/70"
                />
                <kbd className="hidden shrink-0 rounded border border-[var(--glass-border)] px-1.5 py-0.5 text-[10px] text-muted sm:block">
                  Esc
                </kbd>
              </label>

              {q.trim() && (
                <div className="max-h-[50vh] overflow-y-auto overscroll-contain p-2">
                  {hits.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted">
                      {loading ? "…" : t("search.empty")}
                    </p>
                  ) : (
                    hits.map((hit, i) => (
                      <button
                        key={hit.slug}
                        onClick={() => go(hit)}
                        onMouseEnter={() => setActive(i)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          i === active
                            ? "bg-accent-soft"
                            : "hover:bg-white/40 dark:hover:bg-white/10"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            <Highlight text={hit.title} kw={q} />
                          </p>
                          {hit.description && (
                            <p className="truncate text-xs text-muted">
                              <Highlight text={hit.description} kw={q} />
                            </p>
                          )}
                        </div>
                        {hit.category && (
                          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent">
                            {hit.category}
                          </span>
                        )}
                        {i === active && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              <p className="border-t border-[var(--glass-border)] px-4 py-2 text-[10px] text-muted">
                {t("search.hint")}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
