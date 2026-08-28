"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/markdown";

/** 文章目录：滚动高亮当前章节 + 平滑滚动定位 */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    if (!items.length) return;
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [items]);

  if (!items.length) return null;

  return (
    <nav className="glass-card max-h-[70vh] overflow-y-auto p-5 text-sm">
      <p className="mb-3 text-xs font-semibold tracking-widest text-muted">目录</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block rounded-lg border-l-2 py-1 transition-all ${
                item.depth === 3 ? "pl-5" : "pl-3"
              } ${
                active === item.id
                  ? "border-accent bg-accent-soft font-medium text-accent"
                  : "border-transparent text-muted hover:border-accent hover:text-[var(--accent-text)]"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
