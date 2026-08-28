"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];
const key = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** 导航栏日历：月历弹层，有文章的日期带主题色圆点，点击跳归档 */
export function CalendarPopover() {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1 };
  });
  const [days, setDays] = useState<Record<string, number>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  // 打开时拉取当月数据
  useEffect(() => {
    if (!open) return;
    fetch(`/api/calendar?year=${cursor.y}&month=${cursor.m}`)
      .then((r) => r.json())
      .then((d: { days?: Record<string, number> }) => setDays(d.days ?? {}))
      .catch(() => {});
  }, [open, cursor]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const prev = () =>
    setCursor((c) => (c.m === 1 ? { y: c.y - 1, m: 12 } : { ...c, m: c.m - 1 }));
  const next = () =>
    setCursor((c) => (c.m === 12 ? { y: c.y + 1, m: 1 } : { ...c, m: c.m + 1 }));

  // 月历网格：周一起始，前置补空
  const firstDay = new Date(cursor.y, cursor.m - 1, 1);
  const daysInMonth = new Date(cursor.y, cursor.m, 0).getDate();
  const lead = (firstDay.getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (d: number) =>
    today.getFullYear() === cursor.y &&
    today.getMonth() + 1 === cursor.m &&
    today.getDate() === d;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="日历"
        className="glass-button !rounded-full !p-2.5"
      >
        <CalendarDays className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="glass-card absolute right-0 top-12 z-50 w-72 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <button onClick={prev} aria-label="上个月" className="glass-button !rounded-lg !p-1.5">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-sm font-semibold">
                {cursor.y} 年 {cursor.m} 月
              </span>
              <button onClick={next} aria-label="下个月" className="glass-button !rounded-lg !p-1.5">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[10px] text-muted">
              {WEEK.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (d === null) return <span key={`e-${i}`} />;
                const count = days[key(cursor.y, cursor.m, d)] ?? 0;
                const content = (
                  <span
                    className={`relative flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors ${
                      isToday(d)
                        ? "bg-accent-gradient font-bold text-white"
                        : count > 0
                          ? "bg-accent-soft font-medium text-accent"
                          : "text-muted hover:bg-white/40 dark:hover:bg-white/10"
                    }`}
                    title={count > 0 ? `${count} 篇文章` : undefined}
                  >
                    {d}
                    {count > 0 && !isToday(d) && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent-solid" />
                    )}
                  </span>
                );
                return (
                  <span key={d} className="flex justify-center">
                    {count > 0 ? (
                      <Link href="/archive" title={`${count} 篇文章`}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
