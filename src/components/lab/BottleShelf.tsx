"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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

/* 交互语义（层级手势，互不抢戏）：
 * 轻点 = 拿起端详；按住不动 220ms = 举起预备（上浮 + 轻响）；按下后移动 >7px 或举着移动 = 拖拽；
 * 拖拽中快速左右甩 = 摇晃冒泡（彩蛋，不打断拖拽）；松手够快 = 甩出投掷（抛体弹跳后归位）。
 * 拖拽/投掷期间真身只 visibility 隐藏（继续占位、参与换位重排），指针与物理驱动的是
 * cloneNode 出来的拖影——absolute 定位、transform 逐帧直写、完全不经 React 渲染。 */
const DRAG_SLOP = 7; // 起拖位移阈值（相对按下点的欧氏距离）
const HOLD_MS = 220; // 按住不动多久进入"举起"预备态
const THROW_SPEED = 0.35; // px/ms —— 松手速度超过它才进入抛体飞行
const GRAVITY = 0.0022; // px/ms²
const REST_Y = 0.45; // 底板恢复系数（弹跳感）
const REST_X = 0.6; // 侧壁恢复系数
const FRICTION = 0.72; // 撞板水平摩擦
const TILT_MAX = 8; // 拖拽倾角上限（deg）——"提着瓶子走"的活感
const FLIP_WINDOW = 400; // 摇晃判定时间窗
const FLIP_MIN = 3; // 窗内水平换向次数达到即触发摇晃
const FLIP_VX = 0.12; // 计一次换向所需的最小水平速度
const DWELL_MS = 80; // 换位滞回：指针压住目标瓶多久才换位（防临界震荡）
const SHAKE_COOLDOWN = 1200;
const FLIP_ANIM_MS = 160; // 让位瓶子的 FLIP 动画时长
const FLIGHT_FUSE = 6_000; // 投掷超时保险丝

type Phase = "press" | "lifted" | "drag";

interface Gesture {
  phase: Phase;
  id: number;
  pointerId: number;
  /** 按下点（press 阶段判 slop 用；起拖后 transform 走 grab 偏移，不再用它） */
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /** EMA 平滑速度（倾角/摇晃检测用；投掷测速另走 samples） */
  vx: number;
  vy: number;
  samples: { x: number; y: number; t: number }[];
  flips: number[];
  lastDir: number;
  lastShake: number;
  tilt: number;
  el: HTMLElement | null;
  ghost: HTMLElement | null;
  ghostX: number;
  ghostY: number;
  /** 抓取点相对瓶身左上角的偏移——抓哪里就提哪里 */
  grabX: number;
  grabY: number;
  hoverId: number | null;
  hoverSince: number;
  raf: number;
  holdTimer: ReturnType<typeof setTimeout> | null;
}

interface FlightState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
  start: number;
  last: number;
  ghost: HTMLElement;
  el: HTMLElement | null;
}

/**
 * 漂流瓶架：留星 / 成就 / 节气节日 / 跨年 的封存纪念。
 * 瓶型/材质/瓶塞由 lib/bottle-style 从身份推导，瓶内是封存当天的微缩风景。
 * 交互：轻点端详（故事卡）、按住即拖（真身隐、拖影跟手、让位瓶 FLIP 平移）、
 * 拖拽中甩动摇晃（水声冒泡）、甩出投掷（撞框反弹后归位）、故事卡里开瓶（不可逆仪式）、
 * 投影到夜空。顺序存本地（cl-bottle-order），API/数据库零感知。
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
  const [nudged, setNudged] = useState<Set<number>>(new Set());
  const [opening, setOpening] = useState<number | null>(null);
  const [yearEnd] = useState(() => isYearEndWindow());

  const dragRef = useRef<Gesture | null>(null);
  const flightRef = useRef<FlightState | null>(null);
  const flightRafRef = useRef(0);

  /* 手势 effect 只挂一次，闭包里的可变量全走 ref 桥接（照抄 Fireworks 的 soundRef 模式） */
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

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
  const displayRef = useRef(display);
  displayRef.current = display;

  const persistOrder = useCallback((ids: number[]) => {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    } catch {}
  }, []);

  /** 换位：把 id 移到 target 旁（mode: before/after），并持久化（恒稳定，供手势闭包引用） */
  const moveItem = useCallback(
    (id: number, targetId: number, mode: "before" | "after") => {
      const list = displayRef.current;
      if (!list || id === targetId) return;
      const ids = list.map((b) => b.id);
      const from = ids.indexOf(id);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return;
      ids.splice(from, 1);
      const insertAt = ids.indexOf(targetId) + (mode === "after" ? 1 : 0);
      ids.splice(insertAt, 0, id);
      setCustomOrder(ids);
      persistOrder(ids);
    },
    [persistOrder],
  );

  const nudgeNeighbors = useCallback((id: number) => {
    const list = displayRef.current;
    if (!list) return;
    const i = list.findIndex((b) => b.id === id);
    const next = new Set<number>();
    if (i > 0) next.add(list[i - 1]!.id);
    if (i >= 0 && i < list.length - 1) next.add(list[i + 1]!.id);
    if (!next.size) return;
    setNudged((prev) => new Set([...prev, ...next]));
    setTimeout(
      () =>
        setNudged((prev) => {
          const copy = new Set(prev);
          for (const n of next) copy.delete(n);
          return copy;
        }),
      1200,
    );
  }, []);

  /** 键盘/辅助技术开卡（手势外的可达性入口；useCallback 恒稳定，BottleItem memo 不破） */
  const openById = useCallback((id: number) => {
    const b = displayRef.current?.find((x) => x.id === id);
    if (b) setPicked(b);
  }, []);

  /* ---- 手势 + 投掷：原生事件全权驱动，一次挂载，闭包永不过期 ---- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    /** 换位 + FLIP：其余瓶子从旧位置平滑滑到新位置（WAAPI，动画期覆盖 transition/hover） */
    const reorderWithFlip = (id: number, targetId: number, mode: "before" | "after") => {
      const before = new Map<number, { left: number; top: number }>();
      root.querySelectorAll<HTMLElement>("[data-bottle-id]").forEach((el) => {
        const r = el.getBoundingClientRect();
        before.set(Number(el.dataset.bottleId), { left: r.left, top: r.top });
      });
      flushSync(() => moveItem(id, targetId, mode));
      root.querySelectorAll<HTMLElement>("[data-bottle-id]").forEach((el) => {
        const b = before.get(Number(el.dataset.bottleId));
        if (!b) return;
        const r = el.getBoundingClientRect();
        const dx = b.left - r.left;
        const dy = b.top - r.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
            duration: FLIP_ANIM_MS,
            easing: "ease-out",
          });
        }
      });
    };

    /** 拖影：克隆真身（去掉 data-bottle-id 防止命中自身），absolute + transform 直写 */
    const spawnGhost = (g: Gesture) => {
      const el = g.el;
      if (!el) return;
      const rootR = root.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-bottle-id");
      ghost.classList.add("is-dragging");
      ghost.style.position = "absolute";
      ghost.style.left = "0";
      ghost.style.top = "0";
      ghost.style.margin = "0";
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "30";
      ghost.style.visibility = "visible";
      ghost.tabIndex = -1;
      g.ghostX = r.left - rootR.left;
      g.ghostY = r.top - rootR.top;
      g.grabX = g.lastX - r.left;
      g.grabY = g.lastY - r.top;
      ghost.style.transformOrigin = `${g.grabX}px ${g.grabY}px`;
      ghost.style.transform = `translate(${g.ghostX}px, ${g.ghostY}px)`;
      root.appendChild(ghost);
      g.ghost = ghost;
      el.style.visibility = "hidden"; // 真身隐身让位（仍占位、参与换位重排）
    };

    const restoreBottle = (g: { el: HTMLElement | null }) => {
      const el = g.el;
      if (!el) return;
      el.style.visibility = "";
      el.classList.remove("is-lifted");
      el.classList.add("is-landing");
      setTimeout(() => el.classList.remove("is-landing"), 200);
    };

    /** 慢放：拖影移除、真身 squash 落地、邻瓶摆动、顺序持久化 */
    const settleDown = (g: Gesture) => {
      if (g.raf) cancelAnimationFrame(g.raf);
      g.ghost?.remove();
      g.ghost = null;
      restoreBottle(g);
      bsPutdown(soundRef.current, 0.7);
      nudgeNeighbors(g.id);
      const list = displayRef.current;
      if (list) persistOrder(list.map((b) => b.id));
    };

    /* ---- 投掷物理：同一拖影继续抛体 + 撞框反弹（rAF 直写，不触发整架重渲染） ---- */
    const settleFlight = () => {
      const f = flightRef.current;
      flightRef.current = null;
      if (flightRafRef.current) cancelAnimationFrame(flightRafRef.current);
      flightRafRef.current = 0;
      if (!f) return;
      f.ghost.remove();
      const rootR = root.getBoundingClientRect();
      const cx = rootR.left + f.x + 20;
      const cy = rootR.top + f.y + 24;
      const under = document.elementFromPoint(cx, cy)?.closest<HTMLElement>("[data-bottle-id]");
      const targetId = under ? Number(under.dataset.bottleId) : null;
      if (under && targetId && targetId !== f.id) {
        const r = under.getBoundingClientRect();
        reorderWithFlip(f.id, targetId, cx > r.left + r.width / 2 ? "after" : "before");
      }
      restoreBottle(f);
      bsPutdown(soundRef.current, 0.5);
      nudgeNeighbors(f.id);
      const list = displayRef.current;
      if (list) persistOrder(list.map((b) => b.id));
    };

    const flightTick = (now: number) => {
      const f = flightRef.current;
      if (!f) {
        flightRafRef.current = 0;
        return;
      }
      const dt = Math.min(32, now - f.last);
      f.last = now;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += GRAVITY * dt;
      const W = root.clientWidth;
      const H = root.clientHeight;
      const floorY = H - 66; // 层板面
      if (f.y > floorY) {
        f.y = floorY;
        if (Math.abs(f.vy) > 0.1) {
          bsPutdown(soundRef.current, Math.min(1, Math.abs(f.vy) / 1.2));
          f.vy = -f.vy * REST_Y;
          f.vx *= FRICTION;
          f.bounces += 1;
        }
      }
      if (f.x < 2) { f.x = 2; f.vx = Math.abs(f.vx) * REST_X; }
      if (f.x > W - 42) { f.x = W - 42; f.vx = -Math.abs(f.vx) * REST_X; }
      if (f.y < -26) { f.y = -26; f.vy = Math.abs(f.vy) * REST_X; }
      const spin = Math.max(-24, Math.min(24, f.vx * 22));
      f.ghost.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${spin}deg)`;
      if ((Math.abs(f.vy) < 0.16 && f.y >= floorY - 0.5) || f.bounces > 4 || now - f.start > FLIGHT_FUSE) settleFlight();
      else flightRafRef.current = requestAnimationFrame(flightTick);
    };

    const startFlight = (g: Gesture, vx: number, vy: number) => {
      if (!g.ghost) {
        settleDown(g);
        return;
      }
      flightRef.current = {
        id: g.id,
        x: g.ghostX,
        y: g.ghostY,
        vx,
        vy,
        bounces: 0,
        start: performance.now(),
        last: performance.now(),
        ghost: g.ghost,
        el: g.el,
      };
      g.ghost = null; // 所有权移交给 flight（settle 时移除）
      flightRafRef.current = requestAnimationFrame(flightTick);
    };

    /** 拖影逐帧：跟手 transform + 速度倾角 + 摇晃换向检测 + 滞回换位 */
    const dragFrame = (g: Gesture) => {
      g.raf = 0;
      if (dragRef.current !== g || g.phase !== "drag") return;
      const rootR = root.getBoundingClientRect();
      const tx = g.lastX - rootR.left - g.grabX;
      const ty = g.lastY - rootR.top - g.grabY;
      g.ghostX = tx;
      g.ghostY = ty;
      const targetTilt = Math.max(-TILT_MAX, Math.min(TILT_MAX, g.vx * 12));
      g.tilt += (targetTilt - g.tilt) * 0.2;
      g.ghost?.style.setProperty(
        "transform",
        `translate(${tx}px, ${ty}px) rotate(${g.tilt.toFixed(2)}deg) scale(1.12)`,
      );
      const now = performance.now();
      // 摇晃彩蛋：水平速度在时间窗内换向 ≥3 次 → 瓶体 jiggle + 水声（拖拽继续）
      if (Math.abs(g.vx) > FLIP_VX) {
        const dir = Math.sign(g.vx);
        if (g.lastDir !== 0 && dir !== g.lastDir) g.flips.push(now);
        g.lastDir = dir;
      }
      g.flips = g.flips.filter((tm) => now - tm < FLIP_WINDOW);
      if (g.flips.length >= FLIP_MIN && now - g.lastShake > SHAKE_COOLDOWN) {
        g.lastShake = now;
        g.flips = [];
        const visual = g.ghost?.querySelector(".bottle");
        visual?.classList.add("is-shaking");
        bsSlosh(soundRef.current);
        setTimeout(() => visual?.classList.remove("is-shaking"), 1200);
      }
      // 换位（滞回：压住目标瓶 80ms 才换，换完重置驻留计时）
      const under = document.elementFromPoint(g.lastX, g.lastY)?.closest<HTMLElement>("[data-bottle-id]");
      const targetId = under ? Number(under.dataset.bottleId) : null;
      if (under && targetId && targetId !== g.id) {
        if (g.hoverId !== targetId) {
          g.hoverId = targetId;
          g.hoverSince = now;
        } else if (now - g.hoverSince > DWELL_MS) {
          const r = under.getBoundingClientRect();
          reorderWithFlip(g.id, targetId, g.lastX > r.left + r.width / 2 ? "after" : "before");
          g.hoverId = null;
        }
      } else {
        g.hoverId = null;
      }
      // 指针停住后速度/倾角指数回零，回到静止即停帧（省电），move 再唤醒
      g.vx *= 0.88;
      g.vy *= 0.88;
      if (Math.abs(g.vx) > 0.02 || Math.abs(g.tilt) > 0.15) g.raf = requestAnimationFrame(() => dragFrame(g));
    };

    const scheduleDragFrame = (g: Gesture) => {
      if (g.raf === 0) g.raf = requestAnimationFrame(() => dragFrame(g));
    };

    const beginDrag = (g: Gesture, x: number, y: number, alreadyLifted: boolean) => {
      if (g.holdTimer) clearTimeout(g.holdTimer);
      g.holdTimer = null;
      g.phase = "drag";
      g.lastX = x;
      g.lastY = y;
      g.samples.push({ x, y, t: performance.now() });
      spawnGhost(g);
      g.el?.classList.remove("is-lifted");
      if (!alreadyLifted) bsPickup(soundRef.current);
      scheduleDragFrame(g);
    };

    const clearHold = (g: Gesture) => {
      if (g.holdTimer) clearTimeout(g.holdTimer);
      g.holdTimer = null;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-bottle-id]");
      if (!el || !root.contains(el)) return;
      if (dragRef.current || flightRef.current) return;
      const now = performance.now();
      const g: Gesture = {
        phase: "press",
        id: Number(el.dataset.bottleId),
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        vx: 0,
        vy: 0,
        samples: [{ x: e.clientX, y: e.clientY, t: now }],
        flips: [],
        lastDir: 0,
        lastShake: 0,
        tilt: 0,
        el,
        ghost: null,
        ghostX: 0,
        ghostY: 0,
        grabX: 0,
        grabY: 0,
        hoverId: null,
        hoverSince: 0,
        raf: 0,
        holdTimer: null,
      };
      dragRef.current = g;
      // 指针捕获：等待/举起阶段滑出小目标（34×54px）不断连
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      g.holdTimer = setTimeout(() => {
        if (dragRef.current === g && g.phase === "press") {
          g.phase = "lifted";
          g.el?.classList.add("is-lifted");
          bsPickup(soundRef.current);
        }
      }, HOLD_MS);
    };

    const onMove = (e: PointerEvent) => {
      const g = dragRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      const now = performance.now();
      const dt = Math.max(1, now - g.samples[g.samples.length - 1]!.t);
      g.vx = g.vx * 0.75 + ((e.clientX - g.lastX) / dt) * 0.25;
      g.vy = g.vy * 0.75 + ((e.clientY - g.lastY) / dt) * 0.25;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      g.samples.push({ x: e.clientX, y: e.clientY, t: now });
      if (g.samples.length > 6) g.samples.shift();
      if (g.phase !== "drag") {
        const dist = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
        if (dist > DRAG_SLOP) beginDrag(g, e.clientX, e.clientY, g.phase === "lifted");
        return;
      }
      scheduleDragFrame(g);
    };

    const onUp = (e: PointerEvent) => {
      const g = dragRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      dragRef.current = null;
      clearHold(g);
      if (g.phase === "press") {
        // 轻点：拿起端详
        const b = displayRef.current?.find((x) => x.id === g.id);
        if (b) setPicked(b);
        return;
      }
      if (g.phase === "lifted") {
        g.el?.classList.remove("is-lifted");
        bsPutdown(soundRef.current, 0.5);
        return;
      }
      // 拖拽结束：近 120ms 位移测速 → 投掷或轻放
      const now = performance.now();
      const recent = g.samples.filter((s) => now - s.t < 120);
      const first = recent[0] ?? g.samples[0];
      const last = g.samples[g.samples.length - 1] ?? first;
      const dt = Math.max(16, (last?.t ?? now) - (first?.t ?? now));
      const vx = ((last?.x ?? e.clientX) - (first?.x ?? e.clientX)) / dt;
      const vy = ((last?.y ?? e.clientY) - (first?.y ?? e.clientY)) / dt;
      if (Math.hypot(vx, vy) > THROW_SPEED) {
        startFlight(g, Math.max(-1.2, Math.min(1.2, vx)), Math.max(-0.6, Math.min(1.6, vy)));
      } else {
        settleDown(g);
      }
    };

    const onCancel = (e: PointerEvent) => {
      const g = dragRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      dragRef.current = null;
      clearHold(g);
      if (g.phase === "drag") settleDown(g);
      else g.el?.classList.remove("is-lifted");
    };

    // 切标签页/失焦丢 pointerup 的兜底
    const onBlur = () => {
      const g = dragRef.current;
      if (!g) return;
      dragRef.current = null;
      clearHold(g);
      if (g.phase === "drag") settleDown(g);
      else g.el?.classList.remove("is-lifted");
    };

    root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onBlur);
    return () => {
      root.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onBlur);
      if (flightRafRef.current) cancelAnimationFrame(flightRafRef.current);
      flightRafRef.current = 0;
      const f = flightRef.current;
      flightRef.current = null;
      f?.ghost.remove();
      const g = dragRef.current;
      dragRef.current = null;
      if (g) {
        if (g.raf) cancelAnimationFrame(g.raf);
        if (g.holdTimer) clearTimeout(g.holdTimer);
        g.ghost?.remove();
        g.el?.classList.remove("is-lifted", "is-landing");
        g.el?.style.removeProperty("visibility");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveItem, nudgeNeighbors, persistOrder]);

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
              <BottleItem key={b.id} b={b} name={nameOf(b)} nudged={nudged.has(b.id)} onOpen={openById} />
            ))}
            {ri === rows.length - 1 &&
              Array.from({ length: (PER_ROW - row.length) % PER_ROW }).map((_, i) => <span key={i} className="w-[34px]" />)}
          </div>
          <div className="shelf-board" aria-hidden />
        </div>
      ))}

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

/** 瓶子视觉：架子、故事卡、拖影克隆共用。形态属性由 bottleStyleOf 推导。 */
function BottleVisual({ b, opening }: { b: BottleRow; opening?: boolean }) {
  const style: BottleStyle = useMemo(() => bottleStyleOf(b), [b.kind, b.refKey, b.id]);
  const moon = b.kind === "festival" && b.refKey.startsWith("lunar-moon");
  const fw = b.kind === "newyear" || b.kind === "festival" || (b.refKey.startsWith("lunar-spring") || b.refKey.startsWith("lunar-lantern"));
  return (
    <span
      className={["bottle", opening ? "is-opening" : ""].filter(Boolean).join(" ")}
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
 * 架子上的展示瓶（memo，零手势逻辑——手势全在父组件的原生事件里，
 * 拖拽中的视觉由克隆拖影接管）。键盘 Enter/Space 触发的 click（e.detail===0）也能开故事卡。
 */
const BottleItem = memo(function BottleItem({
  b,
  name,
  nudged,
  onOpen,
}: {
  b: BottleRow;
  name: string;
  nudged: boolean;
  onOpen: (id: number) => void;
}) {
  return (
    <button
      type="button"
      data-bottle-id={b.id}
      title={name}
      aria-label={name}
      onClick={(e) => {
        if (e.detail === 0) onOpen(b.id);
      }}
      className={`bottle-item relative cursor-grab touch-none select-none transition-transform duration-200 hover:-translate-y-1 active:cursor-grabbing${
        nudged ? " is-nudged" : ""
      }`}
    >
      <BottleVisual b={b} />
    </button>
  );
});
