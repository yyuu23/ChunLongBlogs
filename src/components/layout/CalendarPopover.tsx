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

/**
 * 导航栏日历：三级快速导航
 * 日视图（左右翻月）→ 点击标题 → 年内选月 → 点击年份标题 → 十年区间选年
 */
export function CalendarPopover() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1 };
  });
  const [days, setDays] = useState<Record<string, number>>({});
  const [holidays, setHolidays] = useState<MonthHolidays>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  useEffect(() => {
    if (!open || view !== "days") return;
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
  }, [open, cursor, view]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openPanel = () => {
    setOpen((v) => !v);
    setView("days");
  };

  const prevMonth = () =>
    setCursor((c) => (c.m === 1 ? { y: c.y - 1, m: 12 } : { ...c, m: c.m - 1 }));
  const nextMonth = () =>
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

  // 十年区间起点（如 2026 → 2021..2032 共 12 格）
  const decadeStart = Math.floor(cursor.y / 10) * 10 + 1;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={openPanel}
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
            {/* ===== 标题栏：随视图变化，可点击下钻 ===== */}
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => {
                  if (view === "days") prevMonth();
                  else if (view === "months") setCursor((c) => ({ ...c, y: c.y - 1 }));
                  else setCursor((c) => ({ ...c, y: c.y - 10 }));
                }}
                aria-label="上一个"
                className="glass-button !rounded-lg !p-1.5"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setView((v) => (v === "days" ? "months" : "years"))}
                className="rounded-lg px-2.5 py-1 text-sm font-semibold transition-colors hover:bg-white/40 dark:hover:bg-white/10"
                title={view === "days" ? "点击选择月份" : view === "months" ? "点击选择年份" : undefined}
              >
                {view === "days" && `${cursor.y} 年 ${cursor.m} 月`}
                {view === "months" && `${cursor.y} 年`}
                {view === "years" && `${decadeStart} - ${decadeStart + 11}`}
              </button>

              <button
                onClick={() => {
                  if (view === "days") nextMonth();
                  else if (view === "months") setCursor((c) => ({ ...c, y: c.y + 1 }));
                  else setCursor((c) => ({ ...c, y: c.y + 10 }));
                }}
                aria-label="下一个"
                className="glass-button !rounded-lg !p-1.5"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 视图切换动画：日→月向左，月→年向左，返回向右 */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view + (view === "years" ? decadeStart : cursor.y)}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="min-h-56"
              >
                {/* ===== 日视图 ===== */}
                {view === "days" && (
                  <>
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
                              kind === "holiday"
                                ? "法定节假日"
                                : kind === "workday"
                                  ? "调休补班"
                                  : undefined,
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
                    <div className="mt-3 flex items-center justify-center gap-4 border-t border-[var(--glass-border)] pt-2.5 text-[10px] text-muted">
                      <span className="flex items-center gap-1">
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">休</span>
                        法定假
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold text-white">工</span>
                        调休
                      </span>
                      <span className="text-rose-400">双休</span>
                      <span className="flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-accent-solid" />
                        有文章
                      </span>
                    </div>
                  </>
                )}

                {/* ===== 月视图：一年 12 格 ===== */}
                {view === "months" && (
                  <div className="grid grid-cols-3 gap-1.5 py-1">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const isCurrentMonth =
                        today.getFullYear() === cursor.y && today.getMonth() + 1 === m;
                      return (
                        <button
                          key={m}
                          onClick={() => {
                            setCursor((c) => ({ ...c, m }));
                            setView("days");
                          }}
                          className={`flex h-12 items-center justify-center rounded-xl text-sm transition-colors ${
                            isCurrentMonth
                              ? "bg-accent-gradient font-bold text-white shadow"
                              : cursor.m === m
                                ? "bg-accent-soft font-semibold text-accent"
                                : "text-muted hover:bg-white/40 dark:hover:bg-white/10"
                          }`}
                        >
                          {m} 月
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ===== 年视图：十年 12 格 ===== */}
                {view === "years" && (
                  <div className="grid grid-cols-3 gap-1.5 py-1">
                    {Array.from({ length: 12 }, (_, i) => decadeStart + i).map((y) => {
                      const isCurrentYear = today.getFullYear() === y;
                      return (
                        <button
                          key={y}
                          onClick={() => {
                            setCursor((c) => ({ ...c, y }));
                            setView("months");
                          }}
                          className={`flex h-12 items-center justify-center rounded-xl text-sm tabular-nums transition-colors ${
                            isCurrentYear
                              ? "bg-accent-gradient font-bold text-white shadow"
                              : cursor.y === y
                                ? "bg-accent-soft font-semibold text-accent"
                                : "text-muted hover:bg-white/40 dark:hover:bg-white/10"
                          }`}
                        >
                          {y}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {view !== "days" && (
              <p className="mt-1 text-center text-[10px] text-muted opacity-70">
                点击标题可返回上一级 · 再次点击月份查看日历
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
