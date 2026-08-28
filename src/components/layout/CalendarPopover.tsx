"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { DayKind } from "@/lib/holidays";

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];

interface MonthHolidays {
  [dateKey: string]: { kind: DayKind; name?: string };
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** 角标样式：休（蓝）/ 工（橙） */
function DayBadge({ kind }: { kind: DayKind }) {
  if (kind === "holiday")
    return (
      <span className="absolute -right-0.5 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold leading-none text-white shadow-sm">
        休
      </span>
    );
  if (kind === "workday")
    return (
      <span className="absolute -right-0.5 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold leading-none text-white shadow-sm">
        工
      </span>
    );
  return null;
}

/** 导航栏日历：月历弹层，法定假/调休/双休标注（数据来自 API：本地规则表 + holiday-cn 自动联网） */
export function CalendarPopover() {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1 };
  });
  const [days, setDays] = useState<Record<string, number>>({});
  const [holidays, setHolidays] = useState<MonthHolidays>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  useEffect(() => {
    if (!open) return;
    fetch(`/api/calendar?year=${cursor.y}&month=${cursor.m}`)
      .then((r) => r.json())
      .then(
        (d: {
          days?: Record<string, number>;
          holidays?: MonthHolidays;
        }) => {
          setDays(d.days ?? {});
          setHolidays(d.holidays ?? {});
        },
      )
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
            className="glass-card absolute right-0 top-12 z-50 w-80 p-4"
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
                const dateKey = keyOf(cursor.y, cursor.m, d);
                const rule = holidays[dateKey];
                const kind: DayKind =
                  rule?.kind ??
                  (new Date(cursor.y, cursor.m - 1, d).getDay() % 6 === 0 ? "weekend" : "work");
                const count = days[dateKey] ?? 0;

                // 配色：法定假=蓝，调休=橙，双休=柔和红，工作日=默认
                const base =
                  kind === "holiday"
                    ? "text-blue-600 dark:text-blue-300 font-bold"
                    : kind === "workday"
                      ? "text-orange-600 dark:text-orange-300 font-semibold"
                      : kind === "weekend"
                        ? "text-rose-400 dark:text-rose-300"
                        : "text-muted hover:bg-white/40 dark:hover:bg-white/10";
                const todayCls = isToday(d) ? "bg-accent-gradient !text-white font-bold" : base;

                const content = (
                  <span
                    className={`relative flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors ${todayCls}`}
                    title={[
                      rule?.name,
                      kind === "holiday" ? "法定节假日" : kind === "workday" ? "调休补班" : undefined,
                      count > 0 ? `${count} 篇文章` : undefined,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    {d}
                    <DayBadge kind={kind} />
                    {count > 0 && !isToday(d) && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent-solid" />
                    )}
                  </span>
                );
                return (
                  <span key={d} className="flex justify-center">
                    {count > 0 ? <Link href="/archive">{content}</Link> : content}
                  </span>
                );
              })}
            </div>

            {/* 图例 */}
            <div className="mt-3 flex items-center justify-center gap-4 border-t border-[var(--glass-border)] pt-2.5 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">休</span>
                法定假
              </span>
              <span className="flex items-center gap-1">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold text-white">工</span>
                调休补班
              </span>
              <span className="text-rose-400">双休</span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-accent-solid" />
                有文章
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
