"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useEffects, type ParticleTheme } from "@/components/providers/EffectProvider";
import { Sakura, Fireflies, Leaves, Snow } from "./Particles";

type ActiveParticle = Exclude<ParticleTheme, "auto" | "off"> | null;

const LAYERS: Record<string, (props: { count?: number }) => React.ReactNode> = {
  sakura: Sakura,
  firefly: Fireflies,
  leaf: Leaves,
  snow: Snow,
};

/**
 * 主题粒子层：
 * - auto：亮色樱花 / 暗色萤火虫（默认，随日夜切换）
 * - season：按月份自动（春樱 3-5 / 夏萤 6-8 / 秋叶 9-11 / 冬雪 12-2）
 * - 手动指定：樱花 / 萤火虫 / 落叶 / 雪
 * 切换时 1s 交叉淡化，旧层过渡完卸载
 */
export function ThemeParticles() {
  const { theme } = useTheme();
  const { effects, particleTheme, hydrated } = useEffects();

  let active: ActiveParticle = null;
  if (hydrated && effects.particles) {
    if (particleTheme === "auto") {
      active = theme === "dark" ? "firefly" : "sakura";
    } else if (particleTheme === "season") {
      const month = new Date().getMonth() + 1;
      active =
        month >= 3 && month <= 5
          ? "sakura"
          : month >= 6 && month <= 8
            ? "firefly"
            : month >= 9 && month <= 11
              ? "leaf"
              : "snow";
    } else if (particleTheme !== "off") {
      active = particleTheme;
    }
  }

  // 只挂载当前层与过渡中的旧层
  const mountedRef = useRef<Set<string>>(new Set(active ? [active] : []));
  const [mounted, setMounted] = useState<Set<string>>(mountedRef.current);

  useEffect(() => {
    const next = new Set<string>(active ? [active] : []);
    // 保留旧层用于交叉淡化
    for (const key of mountedRef.current) next.add(key);
    mountedRef.current = next;
    setMounted(next);
    const timer = setTimeout(() => {
      const only = new Set<string>(active ? [active] : []);
      mountedRef.current = only;
      setMounted(only);
    }, 1100);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <>
      {(Object.keys(LAYERS) as Array<keyof typeof LAYERS>).map((key) => {
        if (!mounted.has(key)) return null;
        const Layer = LAYERS[key]!;
        return (
          <div
            key={key}
            className="fixed inset-0 z-[1] transition-opacity duration-1000"
            style={{ opacity: active === key ? 1 : 0 }}
            aria-hidden
          >
            <Layer />
          </div>
        );
      })}
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
      ensureLoop();
    };
    window.addEventListener("pointerdown", onDown);

    // 空闲即停：粒子放完（画布已清空）就停掉 rAF，不再每帧全屏 clearRect 空转；
    // 有新粒子时由 ensureLoop 重启。raf === 0 表示循环未在跑
    const tick = () => {
      particles = particles.filter((p) => p.life > 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!particles.length) {
        raf = 0;
        return;
      }
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
    const ensureLoop = () => {
      if (raf === 0) raf = requestAnimationFrame(tick);
    };

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
