"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useEffects } from "@/components/providers/EffectProvider";
import { Sakura, Fireflies } from "./Particles";

/** 主题粒子层：亮色樱花 / 暗色萤火虫，1s 交叉淡化切换 */
export function ThemeParticles() {
  const { theme } = useTheme();
  const { effects, hydrated } = useEffects();
  const isDark = theme === "dark";

  if (!hydrated || !effects.particles) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[1] transition-opacity duration-1000"
        style={{ opacity: isDark ? 0 : 1 }}
        aria-hidden
      >
        <Sakura />
      </div>
      <div
        className="fixed inset-0 z-[1] transition-opacity duration-1000"
        style={{ opacity: isDark ? 1 : 0 }}
        aria-hidden
      >
        <Fireflies />
      </div>
    </>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
}

const COLORS = ["#818cf8", "#f472b6", "#facc15", "#34d399", "#38bdf8", "#c084fc"];

/** Canvas 点击爆破粒子 */
export function ClickEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { effects, hydrated } = useEffects();

  useEffect(() => {
    if (hydrated && !effects.clickBurst) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let particles: Particle[] = [];
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

    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      // 输入控件、链接与按钮上不触发，避免干扰
      if (target?.closest("input, textarea, button, a, select, [contenteditable]")) return;
      const n = 12 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.6;
        const speed = 1.5 + Math.random() * 3;
        particles.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          life: 1,
          decay: 0.015 + Math.random() * 0.025,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 2 + Math.random() * 3,
        });
      }
      if (particles.length > 300) particles = particles.slice(-300);
    };
    window.addEventListener("pointerdown", onDown);

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles = particles.filter((p) => p.life > 0);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // 重力
        p.vx *= 0.985;
        p.life -= p.decay;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + p.life * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [hydrated, effects.clickBurst]);

  if (hydrated && !effects.clickBurst) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}
