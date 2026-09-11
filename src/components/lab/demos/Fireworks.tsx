"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { useEffects } from "@/components/providers/EffectProvider";
import { fwBoom, fwCrackle, fwLaunch } from "@/lib/fireworks-audio";

/**
 * 烟花实验（/lab/fireworks）：全屏夜空画布，点击/触摸发射烟花——
 * 火箭拖尾升空 → 顶点炸开（球形/环形/双层菊/柳垂四种形态）→ 余晖坠落。
 *
 * 工程约束（照抄 ClickEffect 的成熟模式）：
 * - 纯 Canvas 2D，不依赖 three.js（demo 不该背上 3D 库的体积）；
 * - rAF 无空闲空转：无火箭无粒子且非自动模式即停，交互/自动发射时重启；
 * - DPR 钳制 ≤2；粒子总量封顶 1200（超出丢最旧）；
 * - prefers-reduced-motion：粒子数减半、不开自动模式；
 * - canvas touch-action:none——移动端触控放烟花不触发滚动/下拉刷新；
 * - 配色从站点主题色取（text-accent 探针读计算色）——换主题色 = 换烟花色调；
 * - 音效走全局 EffectFlags.sound 开关（Web Audio 合成，见 lib/fireworks-audio）。
 */

interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  gravity: number;
  drag: number;
  color: string;
  twinkle: number;
}

const MAX_SPARKS = 1200;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** rgb() 字符串 → [r,g,b]（读主题色探针用） */
function parseRgb(css: string): [number, number, number] | null {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function shift([r, g, b]: [number, number, number], t: number): string {
  const f = (v: number) => Math.round(Math.min(255, v + (255 - v) * t));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export default function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);
  const [auto, setAuto] = useState(false);
  const [fired, setFired] = useState(false);
  const t = useT();
  const { effects } = useEffects();
  // 音效开关是会变的 state，而画布 effect 只挂载一次——用 ref 桥接最新值
  const soundRef = useRef(effects.sound);
  soundRef.current = effects.sound;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* 配色：主题色探针（text-accent 类 → 计算色），失败回落经典暖金 */
    let accent = "rgb(255,196,110)";
    try {
      const probe = document.createElement("span");
      probe.className = "text-accent";
      probe.style.position = "fixed";
      probe.style.opacity = "0";
      document.body.appendChild(probe);
      const rgb = parseRgb(getComputedStyle(probe).color);
      probe.remove();
      if (rgb) accent = `rgb(${rgb.join(",")})`;
    } catch {}
    const baseRgb = parseRgb(accent) ?? [255, 196, 110];
    const PALETTE = [accent, shift(baseRgb, 0.35), shift(baseRgb, 0.7), "rgb(255,243,196)"];

    let w = 0;
    let h = 0;
    let rockets: Rocket[] = [];
    let sparks: Spark[] = [];
    let raf = 0;
    let autoTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    /* 静态星空：每次 resize 预渲染一次，主循环只 drawImage */
    let skyCv: HTMLCanvasElement | null = null;
    const paintSky = () => {
      skyCv = document.createElement("canvas");
      skyCv.width = w * dpr;
      skyCv.height = h * dpr;
      const sctx = skyCv.getContext("2d");
      if (!sctx) return;
      sctx.scale(dpr, dpr);
      for (let i = 0; i < 130; i++) {
        const r = Math.random() < 0.9 ? rand(0.4, 1.1) : rand(1.2, 1.8);
        sctx.globalAlpha = rand(0.2, 0.85);
        sctx.fillStyle = Math.random() < 0.15 ? "#bcd7ff" : "#ffffff";
        sctx.beginPath();
        sctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
        sctx.fill();
      }
      sctx.globalAlpha = 1;
    };

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintSky();
    };

    const explode = (x: number, y: number, color: string) => {
      setFired(true);
      setCount((n) => n + 1);
      const pattern = Math.floor(rand(0, 4)); // 球形 / 环形 / 双层菊 / 柳垂
      const n = Math.round(reduced ? rand(40, 80) : rand(120, 240));
      const willow = pattern === 3;
      fwBoom(soundRef.current, willow);
      if (willow) fwCrackle(soundRef.current);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        let speed: number;
        if (pattern === 1) speed = rand(3.8, 4.4); // 环形：速度一致
        else if (pattern === 2) speed = i % 2 ? rand(4.2, 5.2) : rand(1.8, 2.6); // 双层菊
        else if (willow) speed = rand(0.8, 2.2); // 柳垂：慢速下垂
        else speed = rand(1.2, 6.2); // 球形
        sparks.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 1,
          decay: willow ? rand(0.004, 0.008) : rand(0.009, 0.018),
          gravity: willow ? 0.05 : 0.035,
          drag: 0.985,
          color: willow && Math.random() < 0.7 ? "rgb(255,224,160)" : color,
          twinkle: rand(6, 14),
        });
      }
      if (sparks.length > MAX_SPARKS) sparks = sparks.slice(-MAX_SPARKS);
    };

    const launch = (x: number, y: number) => {
      fwLaunch(soundRef.current);
      rockets.push({
        x: x + rand(-30, 30),
        y: h + 12,
        vx: rand(-0.7, 0.7),
        // 按距离定初速：约 0.9~1.3 秒升到点击高度
        vy: -Math.max(6, (h + 12 - y) / rand(55, 75)),
        targetY: y,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? accent,
      });
    };

    const tick = () => {
      rockets = rockets.filter((r) => r.y > r.targetY && r.y < h + 40);
      sparks = sparks.filter((p) => p.life > 0);

      ctx.clearRect(0, 0, w, h);
      if (skyCv) ctx.drawImage(skyCv, 0, 0, w, h);

      // 火箭：亮头 + 每帧撒 2 颗火星尾迹
      ctx.globalCompositeOperation = "lighter";
      for (const r of rockets) {
        r.x += r.vx + Math.sin(r.y * 0.02) * 0.3; // 轻微摇摆
        r.y += r.vy;
        r.vy *= 0.992;
        for (let i = 0; i < 2; i++) {
          sparks.push({
            x: r.x + rand(-1.5, 1.5),
            y: r.y + rand(0, 4),
            vx: rand(-0.4, 0.4),
            vy: rand(0.3, 1.2),
            life: 1,
            decay: rand(0.06, 0.12),
            gravity: 0.02,
            drag: 0.96,
            color: "rgb(255,220,170)",
            twinkle: 20,
          });
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff6dc";
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (r.y <= r.targetY) explode(r.x, r.y, r.color);
      }
      rockets = rockets.filter((r) => r.y > r.targetY);

      // 火花：重力 + 阻力 + 明灭，短线段轨迹（比圆点更像烟花）
      const now = performance.now() / 1000;
      for (const p of sparks) {
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        const px = p.x;
        const py = p.y;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life) * (0.75 + 0.25 * Math.sin(now * p.twinkle));
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.life > 0.5 ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      // 空闲即停：无火箭无粒子且无自动模式（自动模式由 autoTimer 持续喂数）
      if (!rockets.length && !sparks.length && !autoTimer) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const ensureLoop = () => {
      if (raf === 0 && !disposed) raf = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      launch(e.clientX - rect.left, e.clientY - rect.top);
      ensureLoop();
    };

    const scheduleAuto = () => {
      if (disposed) return;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        launch(rand(w * 0.15, w * 0.85), rand(h * 0.12, h * 0.45));
        ensureLoop();
        scheduleAuto();
      }, rand(1200, 2500));
    };

    const stopAuto = () => {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
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
    canvas.addEventListener("pointerdown", onDown);
    document.addEventListener("visibilitychange", onVisibility);
    // 开场先放两发，让人知道这里是干嘛的（reduced-motion 则完全手动）
    if (!reduced) {
      setTimeout(() => {
        launch(w * 0.3, h * 0.3);
        launch(w * 0.68, h * 0.24);
        ensureLoop();
      }, 500);
    }

    // auto 是 state，用事件桥接（effect 只挂载一次，避免重建画布）
    const onAutoToggle = (e: Event) => {
      const on = (e as CustomEvent<{ on: boolean }>).detail.on;
      if (on) {
        scheduleAuto();
        ensureLoop();
      } else {
        stopAuto();
      }
    };
    window.addEventListener("cl-fw-auto", onAutoToggle);

    return () => {
      disposed = true;
      stopAuto();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("cl-fw-auto", onAutoToggle);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const toggleAuto = () => {
    const next = !auto;
    setAuto(next);
    window.dispatchEvent(new CustomEvent("cl-fw-auto", { detail: { on: next } }));
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[radial-gradient(ellipse_at_center,#1e1b4b_0%,#0b1020_55%,#05070f_100%)] shadow-2xl">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair"
        style={{ touchAction: "none" }}
        aria-label={t("lab.fwHint")}
      />
      {!fired && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] animate-pulse text-center text-sm tracking-widest text-white/60">
          {t("lab.fwHint")}
        </p>
      )}
      <div className="absolute bottom-4 right-4 flex items-center gap-2">
        <span className="rounded-full border border-white/15 bg-slate-950/55 px-3 py-1 text-[11px] tabular-nums text-white/70 backdrop-blur">
          {t("lab.fwCount", { n: count })}
        </span>
        <button
          onClick={toggleAuto}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] backdrop-blur transition-colors ${
            auto ? "bg-accent-gradient text-white" : "border border-white/15 bg-slate-950/55 text-white/70 hover:text-white"
          }`}
        >
          <Sparkles className="h-3 w-3" />
          {auto ? t("lab.fwAutoOff") : t("lab.fwAuto")}
        </button>
      </div>
    </div>
  );
}
