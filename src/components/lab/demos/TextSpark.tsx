"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { useEffects } from "@/components/providers/EffectProvider";
import { fwBoom, fwCrackle, fwLaunch } from "@/lib/lab/fireworks-audio";
import { accentColor, parseRgb, rand, shift } from "@/lib/lab/demo-utils";

/**
 * 粒子文字实验（/lab/text-spark）：写一句话，粒子先聚合成字形，再炸成烟花。
 *
 * 工程约束（与其他 demo 一致）：
 * - 纯 Canvas 2D；离屏 canvas fillText + getImageData 按步长采样目标点集，
 *   点数钳制 ≤1600（reduced-motion ≤700，超了自动加大采样步长）；
 * - 相位机：gather（弹簧缓动聚合成字形，每粒子弹性系数微随机）
 *   → hold（正弦微颤 + 指针斥力）→ burst（中心向外 + 重力，短线段渲染）
 *   → 静默 2.5s → respawn 重新聚拢；
 * - hold 时点画布立即引爆；burst 音效复用烟花双音色（fwLaunch + fwBoom/fwCrackle）；
 * - 配色主题色联动（text-accent 探针）；
 * - 输入限长：CJK 计双倍权重，总权重 ≤24（约 12 个汉字 / 24 个字母）；
 * - rAF 空闲即停（burst 完静默期停帧，respawn 定时器唤醒）、document.hidden 必停；
 * - DPR 钳制 ≤2；canvas touch-action:none。
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  k: number;
  color: string;
  life: number;
  decay: number;
  twinkle: number;
}

type Phase = "gather" | "hold" | "burst";

const MAX_POINTS = 1600;
const MAX_POINTS_REDUCED = 700;

/** 汉字/全角计 2、其余计 1；总权重 ≤24 */
function textWeight(s: string): number {
  let w = 0;
  for (const ch of s) w += /[⺀-鿿＀-￯]/.test(ch) ? 2 : 1;
  return w;
}

/** 离屏采样文字目标点：返回画布坐标系下的点集（已居中） */
function samplePoints(text: string, maxPoints: number): { x: number; y: number }[] {
  const off = document.createElement("canvas");
  off.width = 640;
  off.height = 360;
  const c = off.getContext("2d")!;
  const chars = Array.from(text);
  // 字号按长度自适应：短词大、长句小
  const fontSize = Math.max(48, Math.min(150, Math.floor(560 / Math.max(1, chars.length * 0.9))));
  c.font = `900 ${fontSize}px ui-serif, Georgia, serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#fff";
  c.fillText(chars.join(""), 320, 180);
  const data = c.getImageData(0, 0, 640, 360).data;
  let step = 5;
  let pts: { x: number; y: number }[] = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    pts = [];
    for (let y = 0; y < 360; y += step) {
      for (let x = 0; x < 640; x += step) {
        if (data[(y * 640 + x) * 4 + 3]! > 128) pts.push({ x, y });
      }
    }
    if (pts.length <= maxPoints) break;
    step += 2;
  }
  return pts.slice(0, maxPoints);
}

export default function TextSpark() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState("");
  const [started, setStarted] = useState(false);
  const t = useT();
  const { effects } = useEffects();
  const soundRef = useRef(effects.sound);
  soundRef.current = effects.sound;
  const textRef = useRef("");
  textRef.current = text;

  /* 限长：超出权重的输入直接截断 */
  const changeText = (v: string) => {
    let ok = "";
    for (const ch of v) {
      if (textWeight(ok + ch) > 24) break;
      ok += ch;
    }
    setText(ok);
  };

  const fire = () => {
    setStarted(true);
    window.dispatchEvent(new CustomEvent("cl-ts-text", { detail: { text: textRef.current.trim() } }));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const accent = accentColor();
    const baseRgb = parseRgb(accent) ?? [255, 196, 110];
    const PALETTE = [accent, shift(baseRgb, 0.35), shift(baseRgb, 0.7), "rgb(255,243,196)"];

    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let phase: Phase = "gather";
    let phaseT = 0; // 当前相位已进行的帧数
    let respawnTimer: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;
    let disposed = false;
    let currentText = "";
    const pointer = { x: -1, y: -1, active: false };

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** 用新文字重建粒子（scatter：从画布四周随机散布） */
    const buildFor = (text: string) => {
      currentText = text || "✦";
      const pts = samplePoints(currentText, reduced ? MAX_POINTS_REDUCED : MAX_POINTS);
      const scale = Math.min(1.6, (w * 0.9) / 640, (h * 0.7) / 360);
      const ox = (w - 640 * scale) / 2;
      const oy = (h - 360 * scale) / 2;
      particles = pts.map((p) => {
        const edge = Math.floor(rand(0, 4));
        const x = edge === 0 ? rand(-40, 0) : edge === 1 ? rand(w, w + 40) : rand(0, w);
        const y = edge === 2 ? rand(-40, 0) : edge === 3 ? rand(h, h + 40) : rand(0, h);
        return {
          x,
          y,
          vx: 0,
          vy: 0,
          tx: ox + p.x * scale,
          ty: oy + p.y * scale,
          k: rand(0.02, 0.05),
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? accent,
          life: 1,
          decay: rand(0.006, 0.014),
          twinkle: rand(6, 14),
        };
      });
      phase = "gather";
      phaseT = 0;
    };

    const burst = () => {
      phase = "burst";
      phaseT = 0;
      const size = Math.min(1, particles.length / MAX_POINTS);
      fwLaunch(soundRef.current, 0.7);
      fwBoom(soundRef.current, Math.floor(rand(0, 4)), size);
      if (Math.random() < 0.5) fwCrackle(soundRef.current);
      // 中心（字形质心）向外爆发 + 重力
      let cx = 0;
      let cy = 0;
      for (const p of particles) {
        cx += p.tx;
        cy += p.ty;
      }
      cx /= Math.max(1, particles.length);
      cy /= Math.max(1, particles.length);
      for (const p of particles) {
        const a = Math.atan2(p.ty - cy, p.tx - cx) + rand(-0.25, 0.25);
        const speed = rand(1.5, 6.5);
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed;
        p.life = 1;
      }
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      // 深空底 + 微星
      ctx.fillStyle = "#070a18";
      ctx.fillRect(0, 0, w, h);
      const now = performance.now() / 1000;
      phaseT++;

      ctx.globalCompositeOperation = "lighter";
      if (phase === "gather" || phase === "hold") {
        const settling = phase === "hold";
        for (const p of particles) {
          if (phase === "gather") {
            p.vx += (p.tx - p.x) * p.k;
            p.vy += (p.ty - p.y) * p.k;
            p.vx *= 0.86;
            p.vy *= 0.86;
            // 指针斥力：路过时把粒子推开一点，松开又弹回字形
            if (pointer.active) {
              const dx = p.x - pointer.x;
              const dy = p.y - pointer.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 3600 && d2 > 0.01) {
                const d = Math.sqrt(d2);
                p.vx += (dx / d) * (60 / d) * 0.5;
                p.vy += (dy / d) * (60 / d) * 0.5;
              }
            }
          } else {
            // hold：微颤（正弦抖动，字形像在呼吸）
            p.x = p.tx + Math.sin(now * 2.4 + p.tx * 0.05) * 1.1;
            p.y = p.ty + Math.cos(now * 2.1 + p.ty * 0.05) * 1.1;
          }
          p.x += p.vx;
          p.y += p.vy;
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, settling ? 1.5 : 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        // 聚齐判定：整体动能足够小 → hold（gather 最长 3s 兜底）
        if (phase === "gather") {
          let energy = 0;
          for (const p of particles) energy += Math.abs(p.vx) + Math.abs(p.vy);
          if (energy / Math.max(1, particles.length) < 0.05 || phaseT > 180) {
            phase = "hold";
            phaseT = 0;
          }
        } else if (phaseT > (reduced ? 300 : 150)) {
          burst();
        }
      } else {
        // burst：短线段轨迹 + 重力 + 衰减（同烟花火花渲染）
        for (const p of particles) {
          p.vx *= 0.985;
          p.vy = p.vy * 0.985 + 0.05;
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
        const alive = particles.some((p) => p.life > 0);
        if (!alive) {
          // 静默期：停帧，2.5s 后同文字 respawn
          raf = 0;
          respawnTimer = setTimeout(() => {
            respawnTimer = null;
            if (disposed) return;
            buildFor(currentText);
            raf = requestAnimationFrame(tick);
          }, 2500);
          ctx.globalCompositeOperation = "source-over";
          return;
        }
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      if (!disposed) raf = requestAnimationFrame(tick);
    };

    const onText = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (respawnTimer) {
        clearTimeout(respawnTimer);
        respawnTimer = null;
      }
      buildFor(detail.text ?? "");
      if (raf === 0) raf = requestAnimationFrame(tick);
    };
    const onDown = () => {
      if (phase === "hold") burst();
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (raf === 0 && !disposed) {
        // burst 静默期回来也无妨：tick 会走存活检查并重新排 respawn
        raf = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("cl-ts-text", onText);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      if (respawnTimer) clearTimeout(respawnTimer);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("cl-ts-text", onText);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[#070a18] shadow-2xl">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair"
        style={{ touchAction: "none" }}
        aria-label={t("lab.tsHint")}
      />
      {!started && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] animate-pulse text-center text-sm tracking-widest text-white/60">
          {t("lab.tsHint")}
        </p>
      )}
      <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="flex w-full max-w-sm items-center gap-2 rounded-full border border-white/15 bg-slate-950/60 px-3 py-1.5 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
          <input
            value={text}
            onChange={(e) => changeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fire();
            }}
            placeholder={t("lab.tsPlaceholder")}
            aria-label={t("lab.tsPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-xs text-white/90 placeholder:text-white/30 focus:outline-none"
          />
          <button
            onClick={fire}
            className="shrink-0 rounded-full bg-accent-gradient px-3 py-1 text-[11px] font-medium text-white"
          >
            {t("lab.tsGo")}
          </button>
        </div>
      </div>
    </div>
  );
}
