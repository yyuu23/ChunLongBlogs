"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Wine, X } from "lucide-react";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { useEffects } from "@/components/providers/EffectProvider";
import { getVisitorId } from "@/lib/track";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { festivalByKey, isYearEndWindow } from "@/lib/festivals";
import { bottleStyleOf, type BottleStyle } from "@/lib/bottle-style";
import { bsChime, bsPickup, bsPutdown, bsPop, bsSlosh } from "@/lib/bottle-audio";
import { DATE_LOCALE, pick } from "@/lib/i18n/config";

/** /api/bottles 行结构（openedAt 开瓶后回填） */
interface BottleRow {
  id: number;
  kind: "star" | "achievement" | "festival" | "newyear";
  refKey: string;
  title: string;
  theme: string;
  createdAt: number;
  openedAt?: number | null;
}

const PER_ROW = 8;
const ORDER_KEY = "cl-bottle-order";

/* 交互语义（互不干扰的三个手势）：
 * 轻点 = 拿起端详；按住晃动 = 摇晃冒泡；静止长按 350ms = 拖拽（可甩出投掷） */
const DRAG_DELAY = 350;
const DRAG_CANCEL_PX = 10;
const THROW_SPEED = 0.35; // px/ms —— 松手速度超过它才进入抛体飞行
const GRAVITY = 0.0022; // px/ms²
const REST_Y = 0.45; // 底板恢复系数（弹跳感）
const REST_X = 0.6; // 侧壁恢复系数
const FRICTION = 0.72; // 撞板水平摩擦

interface DragState {
  id: number;
  startX: number;
  startY: number;
  samples: { x: number; y: number; t: number }[];
}

interface FlightState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
}

/**
 * 漂流瓶架：留星 / 成就 / 节气节日 / 跨年 的封存纪念。
 * 瓶型/材质/瓶塞由 lib/bottle-style 从身份推导，瓶内是封存当天的微缩风景。
 * 交互：轻点端详（故事卡）、按住摇晃（水声冒泡）、长按拖拽重排（顺序存本地）、
 * 甩出投掷（撞框反弹几下后归位）、双击开瓶（不可逆仪式）、投影到夜空。
 */
export function BottleShelf({ quotes }: { quotes?: Record<string, string> }) {
  const t = useT();
  const { locale } = useLocale();
  const { effects } = useEffects();
  const soundOn = effects.sound;
  const rootRef = useRef<HTMLDivElement>(null);
  /** null = 未加载（首帧壳，hydration 恒定）；[] = 已加载但为空 */
  const [bottles, setBottles] = useState<BottleRow[] | null>(null);
  const [picked, setPicked] = useState<BottleRow | null>(null);
  const [customOrder, setCustomOrder] = useState<number[] | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [flightId, setFlightId] = useState<number | null>(null);
  const [nudged, setNudged] = useState<Set<number>>(new Set());
  const [opening, setOpening] = useState<number | null>(null);
  const [yearEnd] = useState(() => isYearEndWindow());

  const dragRef = useRef<DragState | null>(null);
  const flightRef = useRef<FlightState | null>(null);
  const flightGhostRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    fetch(`/api/bottles?visitorId=${encodeURIComponent(getVisitorId())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { bottles?: BottleRow[] } | null) => setBottles(d?.bottles ?? []))
      .catch(() => setBottles([]));
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started) {
          started = true;
          io.disconnect();
          load();
        }
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    const onRefresh = () => load();
    window.addEventListener("cl-bottle-refresh", onRefresh);
    return () => {
      io.disconnect();
      window.removeEventListener("cl-bottle-refresh", onRefresh);
    };
  }, [load]);

  /* 展示顺序：本地自定义顺序在前，未记录的新瓶按时间线（左旧右新）追加尾部 */
  const display = useMemo(() => {
    if (!bottles) return null;
    const byId = new Map(bottles.map((b) => [b.id, b]));
    const timeline = [...bottles].reverse();
    if (!customOrder) return timeline;
    const stored = customOrder.map((id) => byId.get(id)).filter((b): b is BottleRow => !!b);
    const storedIds = new Set(stored.map((b) => b.id));
    return [...stored, ...timeline.filter((b) => !storedIds.has(b.id))];
  }, [bottles, customOrder]);

  const persistOrder = useCallback((ids: number[]) => {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    } catch {}
  }, []);

  /** 换位：把 id 移到 target 旁（mode: before/after），并持久化 */
  const moveItem = useCallback(
    (id: number, targetId: number, mode: "before" | "after") => {
      if (!display || id === targetId) return;
      const ids = display.map((b) => b.id);
      const from = ids.indexOf(id);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return;
      ids.splice(from, 1);
      const insertAt = ids.indexOf(targetId) + (mode === "after" ? 1 : 0);
      ids.splice(insertAt, 0, id);
      setCustomOrder(ids);
      persistOrder(ids);
    },
    [display, persistOrder],
  );

  const nudgeNeighbors = useCallback(
    (id: number) => {
      if (!display) return;
      const i = display.findIndex((b) => b.id === id);
      const next = new Set<number>();
      if (i > 0) next.add(display[i - 1]!.id);
      if (i >= 0 && i < display.length - 1) next.add(display[i + 1]!.id);
      if (!next.size) return;
      setNudged((prev) => new Set([...prev, ...next]));
      setTimeout(() => setNudged((prev) => {
        const copy = new Set(prev);
        for (const n of next) copy.delete(n);
        return copy;
      }), 1200);
    },
    [display],
  );

  const bottleEl = (id: number) => rootRef.current?.querySelector<HTMLElement>(`[data-bottle-id="${id}"]`) ?? null;

  /* ---- 拖拽：window 级监听（拖出瓶子自身范围也持续跟踪） ---- */
  useEffect(() => {
    if (dragId == null) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.id !== dragId) return;
      const el = bottleEl(dragId);
      if (el) el.style.transform = `translate(${e.clientX - d.startX}px, ${e.clientY - d.startY}px) scale(1.12)`;
      d.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (d.samples.length > 6) d.samples.shift();
      // 实时换位：指针下是哪个格子（拖影自身 pointer-events:none 不会命中自己）
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-bottle-id]");
      const targetId = under ? Number(under.dataset.bottleId) : null;
      if (targetId && targetId !== dragId) {
        const r = under!.getBoundingClientRect();
        moveItem(dragId, targetId, e.clientX > r.left + r.width / 2 ? "after" : "before");
      }
    };
    const finish = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      const el = bottleEl(dragId);
      if (el) {
        el.style.transform = "";
        el.style.pointerEvents = "";
        el.classList.remove("is-dragging");
      }
      setDragId(null);
      if (!d || d.id !== dragId) return;
      // 近 120ms 内的位移速度 → 初速度
      const now = performance.now();
      const recent = d.samples.filter((s) => now - s.t < 120);
      const first = recent[0] ?? d.samples[0];
      const last = d.samples[d.samples.length - 1] ?? first;
      const dt = Math.max(16, (last?.t ?? now) - (first?.t ?? now));
      let vx = ((last?.x ?? e.clientX) - (first?.x ?? e.clientX)) / dt;
      let vy = ((last?.y ?? e.clientY) - (first?.y ?? e.clientY)) / dt;
      const speed = Math.hypot(vx, vy);
      if (speed > THROW_SPEED) {
        startFlight(dragId, Math.max(-1.2, Math.min(1.2, vx)), Math.max(-0.6, Math.min(1.6, vy)));
      } else {
        bsPutdown(soundOn, 0.7);
        nudgeNeighbors(dragId);
        if (display) persistOrder(display.map((b) => b.id));
      }    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, moveItem, nudgeNeighbors, soundOn]);

  const beginDrag = (id: number, x: number, y: number) => {
    dragRef.current = { id, startX: x, startY: y, samples: [{ x, y, t: performance.now() }] };
    const el = bottleEl(id);
    if (el) {
      el.classList.add("is-dragging");
      el.style.pointerEvents = "none"; // 让 elementFromPoint 命中目标格而不是拖影
    }
    setDragId(id);
    bsPickup(soundOn);
  };

  /* ---- 投掷物理：抛体 + 撞框反弹 + 弹跳衰减后归位（变换走 DOM，不触发整架重渲染） ---- */
  const startFlight = (id: number, vx: number, vy: number) => {
    const root = rootRef.current;
    const el = bottleEl(id);
    if (!root || !el) return;
    const rootRect = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    flightRef.current = {
      id,
      x: r.left - rootRect.left,
      y: r.top - rootRect.top,
      vx,
      vy,
      bounces: 0,
    };
    setFlightId(id);
  };

  useEffect(() => {
    if (flightId == null) return;
    let raf = 0;
    let last = performance.now();
    const settle = () => {
      const f = flightRef.current;
      flightRef.current = null;
      setFlightId(null);
      if (!f) return;
      const root = rootRef.current;
      if (root) {
        const rootRect = root.getBoundingClientRect();
        const cx = rootRect.left + f.x + 20;
        const cy = rootRect.top + f.y + 24;
        const under = document.elementFromPoint(cx, cy)?.closest<HTMLElement>("[data-bottle-id]");
        const targetId = under ? Number(under.dataset.bottleId) : null;
        if (targetId && targetId !== f.id) {
          const r = under!.getBoundingClientRect();
          moveItem(f.id, targetId, cx > r.left + r.width / 2 ? "after" : "before");
        }
      }
      bsPutdown(soundOn, 0.5);
      nudgeNeighbors(f.id);
      if (display) persistOrder(display.map((b) => b.id));
    };
    const tick = (now: number) => {
      const f = flightRef.current;
      const root = rootRef.current;
      const ghost = flightGhostRef.current;
      if (!f || !root || !ghost) return;
      const dt = Math.min(32, now - last);
      last = now;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += GRAVITY * dt;
      const W = root.clientWidth;
      const H = root.clientHeight;
      const floorY = H - 66; // 层板面
      if (f.y > floorY) {
        f.y = floorY;
        if (Math.abs(f.vy) > 0.1) {
          bsPutdown(soundOn, Math.min(1, Math.abs(f.vy) / 1.2));
          f.vy = -f.vy * REST_Y;
          f.vx *= FRICTION;
          f.bounces += 1;
        }
      }
      if (f.x < 2) { f.x = 2; f.vx = Math.abs(f.vx) * REST_X; }
      if (f.x > W - 42) { f.x = W - 42; f.vx = -Math.abs(f.vx) * REST_X; }
      if (f.y < -26) { f.y = -26; f.vy = Math.abs(f.vy) * REST_X; }
      const spin = Math.max(-24, Math.min(24, f.vx * 22));
      ghost.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${spin}deg)`;
      if ((Math.abs(f.vy) < 0.16 && f.y >= floorY - 0.5) || f.bounces > 4 || now - 0 > 60_000) settle();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId]);

  /* ---- 瓶子的展示名与故事卡 ---- */
  const nameOf = (b: BottleRow) => {
    if (b.kind === "star") return b.title ? `“${b.title}”` : t("lab.bottleStar");
    if (b.kind === "newyear") return t("lab.bottleNewyear");
    if (b.kind === "achievement") {
      const a = ACHIEVEMENTS.find((x) => x.key === b.refKey);
      return a ? `${a.emoji} ${pick(locale, a.name)}` : t("lab.bottleAchievement");
    }
    const f = festivalByKey(b.refKey);
    return f ? `${f.emoji} ${pick(locale, f.name)}` : t("lab.bottleFestival");
  };

  const kindLabel = (b: BottleRow) =>
    b.kind === "star"
      ? t("lab.bottleStar")
      : b.kind === "newyear"
        ? t("lab.bottleNewyear")
        : b.kind === "achievement"
          ? t("lab.bottleAchievement")
          : t("lab.bottleFestival");

  /** 开瓶：不可逆仪式——瓶塞弹飞、金粒升腾，之后信笺可读、液体剩四成 */
  const openBottle = async () => {
    const b = picked;
    if (!b || b.openedAt || opening != null) return;
    setOpening(b.id);
    bsPop(soundOn);
    await new Promise((r) => setTimeout(r, 950));
    try {
      await fetch("/api/bottles/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: getVisitorId(), bottleId: b.id }),
      });
    } catch {}
    const now = Date.now();
    setBottles((prev) => prev?.map((x) => (x.id === b.id ? { ...x, openedAt: now } : x)) ?? prev);
    setPicked((p) => (p && p.id === b.id ? { ...p, openedAt: now } : p));
    setOpening(null);
  };

  /** 投影到夜空：把瓶里的季节释放在全站 30 秒 */
  const project = () => {
    if (!picked) return;
    bsChime(soundOn);
    window.dispatchEvent(new CustomEvent("cl-bottle-project", { detail: { theme: picked.theme } }));
    setPicked(null);
  };

  const keeperNote = picked?.kind === "festival" ? quotes?.[picked.refKey] : undefined;
  const flightBottle = flightId != null && display ? (display.find((b) => b.id === flightId) ?? null) : null;

  const rows: BottleRow[][] = [];
  if (display) for (let i = 0; i < display.length; i += PER_ROW) rows.push(display.slice(i, i + PER_ROW));

  return (
    <div
      ref={rootRef}
      onContextMenu={(e) => e.preventDefault()}
      className={`glass-card relative p-5${yearEnd ? " shelf-yearend" : ""}`}
    >
      <div className="mb-1 flex items-center gap-2">
        <Wine className="h-4 w-4 text-accent" />
        <p className="text-sm font-semibold">{t("lab.shelfTitle")}</p>
        {bottles && bottles.length > 0 && (
          <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-muted">{bottles.length}</span>
        )}
      </div>
      <p className="mb-4 text-xs text-muted">{t("lab.shelfHint")}</p>

      {bottles === null && <p className="py-6 text-center text-xs text-muted/60">{t("lab.shelfLoading")}</p>}
      {bottles?.length === 0 && <p className="py-6 text-center text-xs text-muted">{t("lab.shelfEmpty")}</p>}

      {rows.map((row, ri) => (
        <div key={ri} className="relative">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1 px-2">
            {row.map((b) => (
              <BottleItem
                key={b.id}
                b={b}
                name={nameOf(b)}
                soundOn={soundOn}
                hidden={flightId === b.id}
                nudged={nudged.has(b.id)}
                onPick={() => setPicked(b)}
                onDown={(x, y) => {
                  if (longPressRef.current) clearTimeout(longPressRef.current);
                  longPressRef.current = setTimeout(() => beginDrag(b.id, x, y), DRAG_DELAY);
                }}
                onCancelDown={() => {
                  if (longPressRef.current) {
                    clearTimeout(longPressRef.current);
                    longPressRef.current = null;
                  }
                }}
              />
            ))}
            {ri === rows.length - 1 &&
              Array.from({ length: (PER_ROW - row.length) % PER_ROW }).map((_, i) => <span key={i} className="w-[34px]" />)}
          </div>
          <div className="shelf-board" aria-hidden />
        </div>
      ))}

      {/* 投掷飞行中的瓶子（拖影）：变换由 rAF 直写 DOM */}
      {flightBottle && (
        <div ref={flightGhostRef} className="pointer-events-none absolute left-0 top-0 z-30" aria-hidden>
          <BottleVisual b={flightBottle} />
        </div>
      )}

      {/* 故事卡：拿起端详 */}
      <AnimatePresence>
        {picked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            onClick={() => setPicked(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="glass-card relative w-[min(22rem,92vw)] !rounded-3xl p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPicked(null)}
                aria-label="close"
                className="absolute right-3 top-3 rounded-full p-1 text-muted hover:text-rose-400"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto my-2 w-fit scale-[2.1] py-4">
                <BottleVisual b={picked} opening={opening === picked.id} />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] text-muted">
                {kindLabel(picked)}
                {picked.openedAt ? ` · ${t("lab.bottleOpened")}` : ""}
              </span>
              <p className="mt-2 font-serif text-lg font-bold">{nameOf(picked)}</p>
              <p className="mt-1 text-xs text-muted">
                {t("lab.bottleSealedAt", { date: new Date(picked.createdAt).toLocaleDateString(DATE_LOCALE[locale]) })}
              </p>

              {/* 节气瓶中信：站长信笺，开瓶后方可读到 */}
              {keeperNote && picked.openedAt ? (
                <blockquote className="mt-3 rounded-2xl border border-amber-200/40 bg-amber-50/60 px-4 py-3 text-left text-xs leading-relaxed text-amber-900 dark:border-amber-200/20 dark:bg-amber-200/10 dark:text-amber-100">
                  <span className="mb-1 block font-semibold">📖 {t("lab.keeperNote")}</span>
                  {keeperNote}
                </blockquote>
              ) : null}

              <div className="mt-4 flex items-center justify-center gap-2">
                {!picked.openedAt && (
                  <button
                    onClick={openBottle}
                    disabled={opening != null}
                    className="rounded-full bg-accent-gradient px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    🍾 {t("lab.openBottle")}
                  </button>
                )}
                <button
                  onClick={project}
                  className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-4 py-1.5 text-xs text-slate-600 transition-colors hover:text-accent dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200"
                >
                  <Sparkles className="h-3 w-3" />
                  {t("lab.projectSky")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 瓶子视觉：架子、故事卡、飞行拖影共用。形态属性由 bottleStyleOf 推导。 */
function BottleVisual({ b, opening, shaking }: { b: BottleRow; opening?: boolean; shaking?: boolean }) {
  const style: BottleStyle = useMemo(() => bottleStyleOf(b), [b.kind, b.refKey, b.id]);
  const moon = b.kind === "festival" && b.refKey.startsWith("lunar-moon");
  const fw = b.kind === "newyear" || b.kind === "festival" || (b.refKey.startsWith("lunar-spring") || b.refKey.startsWith("lunar-lantern"));
  return (
    <span
      className={["bottle", shaking ? "is-shaking" : "", opening ? "is-opening" : ""].filter(Boolean).join(" ")}
      data-theme={b.theme}
      data-shape={style.shape}
      data-material={style.material}
      data-cork={style.cork}
      data-opened={b.openedAt ? "1" : undefined}
    >
      <span className="bottle-cork" />
      <span className="bottle-glass">
        {moon && <span className="bottle-orn-moon" />}
        {fw && (
          <>
            <span className="bottle-orn-fw" />
            <span className="bottle-orn-fw f2" />
          </>
        )}
        <span className="bottle-liquid">
          <span className="bottle-scene">
            <i />
            <i />
            <i />
            {b.theme === "snow" ? <i /> : null}
          </span>
          <span className="bottle-float" />
          <span className="bottle-float f2" />
        </span>
        <span className="bottle-shine" />
        <span className="bottle-spark" />
        <span className="bottle-spark s2" />
        <span className="bottle-spark s3" />
      </span>
    </span>
  );
}

/**
 * 架子上的交互瓶：
 * 轻点 = 拿起端详；按住晃动 = 摇晃（水声+冒泡）；静止长按 350ms = 进入拖拽（交给父级）。
 */
function BottleItem({
  b,
  name,
  soundOn,
  hidden,
  nudged,
  onPick,
  onDown,
  onCancelDown,
}: {
  b: BottleRow;
  name: string;
  soundOn: boolean;
  hidden: boolean;
  nudged: boolean;
  onPick: () => void;
  /** 按下（父级起长按计时） */
  onDown: (x: number, y: number) => void;
  /** 移动超阈值（父级取消长按，让摇晃接管） */
  onCancelDown: () => void;
}) {
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acc = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    acc.current = 0;
    last.current = { x: e.clientX, y: e.clientY };
    onDown(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!last.current) return;
    const d = Math.abs(e.clientX - last.current.x) + Math.abs(e.clientY - last.current.y);
    acc.current += d;
    last.current = { x: e.clientX, y: e.clientY };
    if (acc.current > DRAG_CANCEL_PX) onCancelDown(); // 让位给摇晃
    if (acc.current > 36) {
      if (!shaking) {
        setShaking(true);
        bsSlosh(soundOn);
      }
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShaking(false), 1200);
    }
  };
  const onPointerUp = () => {
    const wasStill = last.current !== null && acc.current <= 10; // 原地点击 = 拿起端详
    last.current = null;
    if (wasStill) onPick();
  };

  return (
    <button
      type="button"
      data-bottle-id={b.id}
      title={name}
      aria-label={name}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        last.current = null;
        onCancelDown();
      }}
      style={hidden ? { visibility: "hidden" } : undefined}
      className={`bottle-item relative cursor-grab touch-none select-none transition-transform duration-200 hover:-translate-y-1 active:cursor-grabbing${
        nudged ? " is-nudged" : ""
      }`}
    >
      <BottleVisual b={b} shaking={shaking} />
    </button>
  );
}
