"use client";

import { useEffect, useRef } from "react";
import { useEffects } from "@/components/providers/EffectProvider";

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  life: number;
  decay: number;
  color: string;
}

const COLORS = ["#fbbf24", "#f472b6", "#818cf8", "#34d399", "#f87171", "#ffffff"];

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rot: number,
  color: string,
) {
  // 四角星：凹边二次曲线连接四个尖角
  const inner = size * 0.32;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    const next = a + Math.PI / 4;
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    ctx.lineTo(Math.cos(next) * inner, Math.sin(next) * inner);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 文字选中星光：拖选文字松开时，选区上方绽开四角星（与点击爆破相互独立） */
export function SelectionSparkle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { effects, hydrated } = useEffects();

  useEffect(() => {
    if (hydrated && !effects.selectionSparkle) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stars: Star[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      let sel: Selection | null = null;
      try {
        sel = window.getSelection();
      } catch {
        return;
      }
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      // 多行选区取每一行的矩形，星星撒在每行选区上方
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 4);
      const lines = rects.length
        ? rects
        : [range.getBoundingClientRect()].filter((r) => r.width > 4);
      for (const rect of lines.slice(0, 8)) {
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          stars.push({
            x: rect.left + Math.random() * rect.width,
            y: rect.top + Math.random() * 6,
            vx: (Math.random() - 0.5) * 1.4,
            vy: -(1.4 + Math.random() * 2),
            size: 4 + Math.random() * 5,
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 0.2,
            life: 1,
            decay: 0.02 + Math.random() * 0.02,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
          });
        }
      }
      if (stars.length > 160) stars = stars.slice(-160);
    };
    document.addEventListener("mouseup", onUp);

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      stars = stars.filter((s) => s.life > 0);
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05;
        s.rot += s.vrot;
        s.life -= s.decay;
        ctx.globalAlpha = Math.max(s.life, 0);
        drawStar(ctx, s.x, s.y, s.size * (0.4 + s.life * 0.6), s.rot, s.color);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("mouseup", onUp);
    };
  }, [hydrated, effects.selectionSparkle]);

  if (hydrated && !effects.selectionSparkle) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[61]"
    />
  );
}
