"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "@/components/providers/LocaleProvider";

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vrot: number;
  color: string;
  shape: "rect" | "circle" | "star";
  sway: number;
  phase: number;
}

const COLORS = [
  "#818cf8", "#f472b6", "#fbbf24", "#34d399", "#38bdf8", "#c084fc", "#fb7185", "#ffffff",
];

/**
 * Logo 七连击彩蛋：全屏彩纸雨（三波共 ~600 片）+ 玻璃 toast。
 * 通过递增 trigger 属性触发。
 */
export function LogoEgg({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [toast, setToast] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setToast(true);
    const toastTimer = setTimeout(() => setToast(false), 2600);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let pieces: Piece[] = [];
    const spawnWave = (n: number) => {
      for (let i = 0; i < n; i++) {
        const shape = (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)];
        pieces.push({
          x: Math.random() * window.innerWidth,
          y: -20 - Math.random() * 80,
          vx: (Math.random() - 0.5) * 1.6,
          vy: 2 + Math.random() * 3,
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 8,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.25,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape,
          sway: 0.6 + Math.random() * 1.2,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };
    // 三波
    spawnWave(220);
    const waves = [setTimeout(() => spawnWave(200), 220), setTimeout(() => spawnWave(180), 460)];

    let raf = 0;
    let start = performance.now();
    const drawStar = (p: Piece) => {
      const s = p.w * 0.7;
      const inner = s * 0.4;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const next = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        ctx.lineTo(Math.cos(next) * inner, Math.sin(next) * inner);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const tick = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pieces = pieces.filter((p) => p.y < window.innerHeight + 30);
      for (const p of pieces) {
        p.phase += 0.05;
        p.x += p.vx + Math.sin(p.phase) * p.sway;
        p.y += p.vy;
        p.vy = Math.min(p.vy + 0.02, 5);
        p.rot += p.vrot;
        ctx.save();
        ctx.globalAlpha = 0.95;
        if (p.shape === "rect") {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else if (p.shape === "circle") {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(p);
        }
        ctx.restore();
      }
      // 全部落完或超过 6 秒即收工
      if ((pieces.length === 0 && elapsed > 800) || elapsed > 6000) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      waves.forEach(clearTimeout);
      clearTimeout(toastTimer);
    };
  }, [trigger]);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[70]" />
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            className="glass-card fixed left-1/2 top-20 z-[71] -translate-x-1/2 px-5 py-3 text-sm font-medium"
          >
            🎉 {t("egg.toast")}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
