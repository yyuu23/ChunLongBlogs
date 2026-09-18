"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Send } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { useEffects } from "@/components/providers/EffectProvider";
import { bsChime } from "@/lib/bottles/audio";
import { rand } from "@/lib/lab/demo-utils";

/**
 * 孔明灯实验（/lab/lanterns）：写一句愿望，放一盏灯。
 *
 * 工程约束（与其他 demo 一致）：
 * - 纯 Canvas 2D；5 档色相的灯 sprite 预渲染到离屏 canvas，运行时只 drawImage，
 *   火苗用单独小渐变叠加 + alpha 闪烁；
 * - 灯升空时 scale 1→0.25 渐远渐暗、正弦横漂（各灯随机相位/振幅）；
 * - 输入愿望（≤30 字）"放飞"或点画布放飞；连放模式每 2~4s 自动放一盏；
 * - 愿望纯本地：localStorage 只存输入草稿，不上传（许愿和留声星不同，
 *   说给夜空听的话不必留档）；
 * - 放飞音效复用瓶艺风铃 bsChime；
 * - rAF 空闲即停（无灯且非连放），document.hidden 必停；
 * - prefers-reduced-motion：上升减速 50%、关掉火苗闪烁；
 * - DPR 钳制 ≤2；canvas touch-action:none。
 */

interface Lantern {
  x: number;
  y: number;
  vx: number;
  phase: number;
  amp: number;
  scale: number;
  riseSpeed: number;
  spriteIdx: number;
  wish: string;
  flame: number;
}

const MAX_LANTERNS = 40;
const DRAFT_KEY = "cl-lantern-wish";

/** 预渲染一档色相的灯 sprite（约 90×130 css px，含光晕） */
function paintLamp(hue: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = 180;
  cv.height = 260;
  const c = cv.getContext("2d")!;
  const cx = 90;
  // 外光晕
  const glow = c.createRadialGradient(cx, 130, 10, cx, 130, 95);
  glow.addColorStop(0, `hsla(${hue}, 95%, 68%, 0.5)`);
  glow.addColorStop(1, `hsla(${hue}, 95%, 60%, 0)`);
  c.fillStyle = glow;
  c.fillRect(0, 0, 180, 260);
  // 灯体：上收下鼓的暖色纸罩
  const body = c.createLinearGradient(cx - 34, 40, cx + 34, 220);
  body.addColorStop(0, `hsl(${hue}, 92%, 76%)`);
  body.addColorStop(0.55, `hsl(${hue}, 97%, 64%)`);
  body.addColorStop(1, `hsl(${hue + 6}, 95%, 52%)`);
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(cx, 44);
  c.bezierCurveTo(cx + 26, 66, cx + 36, 110, cx + 33, 165);
  c.bezierCurveTo(cx + 30, 205, cx + 14, 222, cx, 224);
  c.bezierCurveTo(cx - 14, 222, cx - 30, 205, cx - 33, 165);
  c.bezierCurveTo(cx - 36, 110, cx - 26, 66, cx, 44);
  c.fill();
  // 竹圈底口
  c.strokeStyle = `hsl(${hue + 10}, 60%, 38%)`;
  c.lineWidth = 5;
  c.beginPath();
  c.ellipse(cx, 223, 17, 6, 0, 0, Math.PI * 2);
  c.stroke();
  // 纸罩竖向纹路（微微透光）
  c.strokeStyle = `hsla(${hue}, 90%, 40%, 0.18)`;
  c.lineWidth = 2;
  for (const dx of [-18, -8, 0, 8, 18]) {
    c.beginPath();
    c.moveTo(cx + dx * 0.45, 60);
    c.quadraticCurveTo(cx + dx, 140, cx + dx * 0.9, 216);
    c.stroke();
  }
  return cv;
}

export default function Lanterns() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wish, setWish] = useState("");
  const [auto, setAuto] = useState(false);
  const [released, setReleased] = useState(0);
  const t = useT();
  const { effects } = useEffects();
  const soundRef = useRef(effects.sound);
  soundRef.current = effects.sound;
  // 画布 effect 只挂载一次，UI 侧状态经 ref/自定义事件桥接
  const wishRef = useRef("");
  wishRef.current = wish;
  const autoRef = useRef(auto);
  autoRef.current = auto;

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setWish(saved);
  }, []);

  const changeWish = (v: string) => {
    setWish(v.slice(0, 30));
    try {
      localStorage.setItem(DRAFT_KEY, v.slice(0, 30));
    } catch {}
  };

  const release = () => {
    window.dispatchEvent(new CustomEvent("cl-lantern-release", { detail: { wish: wishRef.current } }));
    setReleased((n) => n + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* 5 档色相：暖橙 / 琥珀 / 桃粉 / 青金 / 月白（月白用低饱和） */
    const sprites = [32, 42, 8, 190, 48].map((hue, i) => paintLamp(i === 4 ? 46 : hue));

    let w = 0;
    let h = 0;
    let lanterns: Lantern[] = [];
    let raf = 0;
    let disposed = false;
    let autoTimer: ReturnType<typeof setTimeout> | null = null;

    /* 夜空：预渲染星星 + 底部远山剪影，主循环只 drawImage */
    let skyCv: HTMLCanvasElement | null = null;
    const paintSky = () => {
      skyCv = document.createElement("canvas");
      skyCv.width = Math.max(1, Math.round(w * dpr));
      skyCv.height = Math.max(1, Math.round(h * dpr));
      const s = skyCv.getContext("2d")!;
      s.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = s.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0b1026");
      bg.addColorStop(0.7, "#141a3a");
      bg.addColorStop(1, "#1d2547");
      s.fillStyle = bg;
      s.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) {
        s.globalAlpha = rand(0.2, 0.8);
        s.fillStyle = Math.random() < 0.2 ? "#bcd7ff" : "#ffffff";
        s.beginPath();
        s.arc(Math.random() * w, Math.random() * h * 0.85, Math.random() < 0.9 ? rand(0.4, 1) : rand(1.2, 1.6), 0, Math.PI * 2);
        s.fill();
      }
      s.globalAlpha = 1;
    };

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintSky();
    };

    const spawn = (text: string) => {
      if (lanterns.length >= MAX_LANTERNS) lanterns = lanterns.slice(-MAX_LANTERNS + 1);
      lanterns.push({
        x: rand(w * 0.18, w * 0.82),
        y: h + 40,
        vx: rand(-0.08, 0.12),
        phase: rand(0, Math.PI * 2),
        amp: rand(0.3, 0.9),
        scale: 1,
        riseSpeed: rand(0.55, 0.85) * (reduced ? 0.5 : 1),
        spriteIdx: Math.floor(rand(0, sprites.length)),
        wish: text.trim(),
        flame: rand(0, Math.PI * 2),
      });
      bsChime(soundRef.current);
      ensureLoop();
    };

    const drawWish = (l: Lantern) => {
      // 愿望只显示前 8 个字（灯小，字多就看不清了），随灯渐远
      const shown = l.wish.length > 8 ? `${l.wish.slice(0, 8)}…` : l.wish;
      if (!shown) return;
      const progress = 1 - l.y / h; // 0 地面 → 1 远顶
      const alpha = Math.max(0, 1 - progress * 1.15);
      if (alpha <= 0.02) return;
      ctx.globalAlpha = alpha * 0.8;
      ctx.font = `${Math.max(9, 12 * l.scale + 3)}px ui-serif, serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,236,200,0.95)";
      ctx.fillText(shown, l.x, l.y + 66 * l.scale + 16);
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      if (skyCv) ctx.drawImage(skyCv, 0, 0, w, h);
      const now = performance.now() / 1000;

      const alive: Lantern[] = [];
      for (const l of lanterns) {
        l.y -= l.riseSpeed;
        l.x += l.vx + Math.sin(now * 0.9 + l.phase) * l.amp * 0.18;
        l.flame += 0.25;
        const progress = Math.min(1, 1 - l.y / h); // 0→1 渐远
        l.scale = 1 - progress * 0.72; // 1 → 0.28
        const alpha = progress < 0.75 ? 1 : Math.max(0, 1 - (progress - 0.75) / 0.25);
        if (l.y < -80 || alpha <= 0) continue;
        const size = 78 * l.scale;
        ctx.globalAlpha = alpha;
        // 火苗：底部小径向渐变，随 flame 相位闪
        const flicker = reduced ? 0.85 : 0.72 + 0.28 * Math.abs(Math.sin(l.flame));
        const fx = l.x;
        const fy = l.y + 34 * l.scale;
        const fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, 22 * l.scale + 6);
        fg.addColorStop(0, `rgba(255,246,214,${0.95 * flicker})`);
        fg.addColorStop(0.4, `rgba(255,196,110,${0.5 * flicker})`);
        fg.addColorStop(1, "rgba(255,170,80,0)");
        ctx.fillStyle = fg;
        ctx.fillRect(fx - 30 * l.scale - 6, fy - 30 * l.scale - 6, 60 * l.scale + 12, 60 * l.scale + 12);
        ctx.drawImage(sprites[l.spriteIdx]!, l.x - size / 2, l.y - size * 0.62, size, size * 1.44);
        drawWish(l);
        ctx.globalAlpha = 1;
        alive.push(l);
      }
      lanterns = alive;

      // 空闲即停：无灯且非连放（连放由 autoTimer 持续喂数）
      if (!lanterns.length && !autoTimer) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const ensureLoop = () => {
      if (raf === 0 && !disposed) raf = requestAnimationFrame(tick);
    };

    const onRelease = (e: Event) => {
      spawn((e as CustomEvent<{ wish: string }>).detail.wish ?? "");
    };
    const onDown = () => spawn(wishRef.current);
    const onAutoToggle = (e: Event) => {
      const on = (e as CustomEvent<{ on: boolean }>).detail.on;
      if (on) scheduleAuto();
      else if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
    };
    const scheduleAuto = () => {
      if (disposed) return;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        spawn(wishRef.current);
        if (autoRef.current) scheduleAuto();
      }, rand(2000, 4000));
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else {
        ensureLoop();
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("cl-lantern-release", onRelease);
    window.addEventListener("cl-lantern-auto", onAutoToggle);
    canvas.addEventListener("pointerdown", onDown);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      if (autoTimer) clearTimeout(autoTimer);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("cl-lantern-release", onRelease);
      window.removeEventListener("cl-lantern-auto", onAutoToggle);
      canvas.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const toggleAuto = () => {
    const next = !auto;
    setAuto(next);
    window.dispatchEvent(new CustomEvent("cl-lantern-auto", { detail: { on: next } }));
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#0b1026_0%,#141a3a_70%,#1d2547_100%)] shadow-2xl">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-pointer"
        style={{ touchAction: "none" }}
        aria-label={t("lab.lanternAria")}
      />
      <p className="pointer-events-none absolute inset-x-0 top-[30%] text-center text-sm tracking-widest text-amber-100/50">
        {t("lab.lanternHint")}
      </p>
      {released === 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] animate-pulse text-center text-xs tracking-widest text-white/40">
          {t("lab.lanternAria")}
        </p>
      )}
      {/* 控制条：愿望输入 + 放飞 + 连放 */}
      <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-amber-200/20 bg-slate-950/60 px-3 py-1.5 backdrop-blur">
          <Flame className="h-3.5 w-3.5 shrink-0 text-amber-300/80" />
          <input
            value={wish}
            onChange={(e) => changeWish(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") release();
            }}
            maxLength={30}
            placeholder={t("lab.lanternPlaceholder")}
            aria-label={t("lab.lanternPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-xs text-amber-50 placeholder:text-amber-100/30 focus:outline-none"
          />
          <button
            onClick={release}
            className="flex shrink-0 items-center gap-1 rounded-full bg-accent-gradient px-3 py-1 text-[11px] font-medium text-white"
          >
            <Send className="h-3 w-3" />
            {t("lab.lanternRelease")}
          </button>
          <button
            onClick={toggleAuto}
            aria-pressed={auto}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
              auto ? "bg-accent-gradient text-white" : "text-amber-100/60 hover:text-amber-100"
            }`}
          >
            {auto ? t("lab.lanternAutoOff") : t("lab.lanternAuto")}
          </button>
        </div>
      </div>
    </div>
  );
}
