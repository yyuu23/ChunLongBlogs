"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/components/providers/LocaleProvider";
import { accentColor, rand } from "@/lib/lab/demo-utils";

/**
 * 代码雨实验（/lab/matrix）：黑客帝国风列式字符雨。
 *
 * 工程约束（与其他 demo 一致）：
 * - 纯 Canvas 2D；半透明黑 fillRect 做拖尾，新字符亮、旧字符自然沉入暗处；
 * - 字符集：片假名 + 数字 + 少量符号，偶发整列"翻转"（换一套字符重新落下）；
 * - 主题色联动（text-accent 探针）——换主题色即换雨色，回落经典绿；
 * - 点击迸发一圈字符波纹（扩散圆环上的字符随半径淡出）；
 * - 雨必须常下（画面静止就没意义了），但 document.hidden 必停；
 * - prefers-reduced-motion：降速 60%、关掉随机翻转闪烁；
 * - DPR 钳制 ≤2；canvas touch-action:none，触屏划动不滚页。
 */

interface Column {
  y: number;
  speed: number;
  /** 下一次翻转的帧计数（到点换字符集重落一列） */
  flipIn: number;
}

interface Ripple {
  x: number;
  y: number;
  r: number;
  maxR: number;
}

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";
const FONT = 16;
const FRAME_GAP = 1; // 每帧推进（拖尾长度由 alpha 决定）

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = useT();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const accent = accentColor("rgb(80,250,120)"); // 经典黑客绿回落
    const head = "rgb(215,255,225)";

    let w = 0;
    let h = 0;
    let cols: Column[] = [];
    let ripples: Ripple[] = [];
    let raf = 0;
    let frame = 0;
    let disposed = false;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(1, Math.floor(w / FONT));
      cols = Array.from({ length: n }, () => ({
        y: rand(-h, 0),
        speed: rand(2.2, 5.2) * (reduced ? 0.4 : 1),
        flipIn: Math.floor(rand(60, 900)),
      }));
      ctx.fillStyle = "#05070f";
      ctx.fillRect(0, 0, w, h);
    };

    const drawCol = (c: Column, x: number) => {
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "0";
      ctx.font = `${FONT}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      // 头字符近白（2% 概率掉进主题色，制造闪烁感）；旧字符沉入拖尾被逐帧压暗
      ctx.fillStyle = Math.random() > 0.02 ? head : accent;
      ctx.fillText(ch, x, c.y);
    };

    const tick = () => {
      frame++;
      // 拖尾：整屏压一层低透明度夜色
      ctx.fillStyle = "rgba(5,7,15,0.09)";
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < cols.length; i++) {
        const c = cols[i]!;
        c.y += c.speed * FRAME_GAP;
        if (c.y > h + FONT * 2) {
          // 一列走完：回到屏幕上方随机处，偶尔"翻转"（速度也换）
          c.y = rand(-160, -FONT);
          c.speed = rand(2.2, 5.2) * (reduced ? 0.4 : 1);
        }
        if (!reduced && frame > c.flipIn) {
          c.flipIn = frame + Math.floor(rand(240, 1200));
          c.y = rand(-80, -FONT);
        }
        drawCol(c, i * FONT + FONT / 2);
      }

      // 点击波纹：圆环上的字符闪现后随环扩大淡出
      if (ripples.length) {
        ctx.font = `${FONT}px ui-monospace, monospace`;
        for (const rp of ripples) {
          rp.r += 4.5;
          const alpha = Math.max(0, 1 - rp.r / rp.maxR);
          if (alpha <= 0) continue;
          const count = Math.max(6, Math.floor((rp.r / FONT) * 1.6));
          for (let k = 0; k < count; k++) {
            const a = (k / count) * Math.PI * 2 + rp.r * 0.02;
            const gx = rp.x + Math.cos(a) * rp.r;
            const gy = rp.y + Math.sin(a) * rp.r * 0.72; // 椭圆更有透视感
            ctx.globalAlpha = alpha * 0.85;
            ctx.fillStyle = k % 5 === 0 ? head : accent;
            ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "0", gx, gy);
          }
          ctx.globalAlpha = 1;
        }
        ripples = ripples.filter((rp) => rp.r < rp.maxR);
      }

      if (disposed) return;
      raf = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        r: 6,
        maxR: rand(140, 240),
      });
      if (ripples.length > 6) ripples = ripples.slice(-6);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (raf === 0 && !disposed) {
        raf = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[#05070f] shadow-2xl">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair"
        style={{ touchAction: "none" }}
        aria-label={t("lab.matrixHint")}
      />
      <p className="pointer-events-none absolute inset-x-0 bottom-16 text-center text-[11px] tracking-widest text-emerald-200/40">
        {t("lab.matrixHint")}
      </p>
    </div>
  );
}
