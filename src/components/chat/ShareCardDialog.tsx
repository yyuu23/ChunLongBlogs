"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { downloadBlob, wrapCanvasText, type ExportMsg } from "@/lib/chatExport";

const W = 1080;
const PADDING = 64;
const BUBBLE_MAX = W - PADDING * 2 - 120; // 气泡最大宽（两侧错位各留 120 头像区）
const AVATAR_FALLBACK = ["#f43f5e", "#ec4899"];

/**
 * 对话分享卡（纯前端 canvas，不上传）：固定取传入的消息（调用方取最后 3 对），
 * 深浅色主题 + 站点主题色渐变背景 + 头像/站名头部 + 交替气泡 + 底部水印。
 * 生成 PNG 供下载（访客自发分享的传播物料）。
 */
export function ShareCardDialog({
  open,
  onClose,
  siteName,
  avatar,
  siteUrl,
  title,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  siteName: string;
  avatar: string | null;
  siteUrl: string;
  title: string;
  messages: ExportMsg[];
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open || !messages.length) return;
    setReady(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dark = document.documentElement.classList.contains("dark");
    const style = getComputedStyle(document.documentElement);
    const accentFrom = style.getPropertyValue("--accent-from").trim() || AVATAR_FALLBACK[0]!;
    const accentTo = style.getPropertyValue("--accent-to").trim() || AVATAR_FALLBACK[1]!;
    const bg = dark ? "#0f172a" : "#f8fafc";
    const cardBg = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.85)";
    const fg = dark ? "#e2e8f0" : "#1e293b";
    const muted = dark ? "#94a3b8" : "#64748b";

    // 布局先行算高：头部 + 每条气泡（行数×行高+padding）+ 水印
    const fontSize = 30;
    ctx.font = `${fontSize}px sans-serif`;
    const laid = messages.slice(0, 6).map((m) => ({
      m,
      lines: wrapCanvasText(ctx, m.content.slice(0, 120), BUBBLE_MAX - 48, 6),
    }));
    const lineHeight = fontSize * 1.6;
    const headerH = 240;
    const bubbleH = (lines: number) => lines * lineHeight + 44;
    const footerH = 120;
    const totalH = Math.min(
      2200,
      headerH + laid.reduce((s, x) => s + bubbleH(x.lines.length) + 28, 0) + footerH,
    );

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.aspectRatio = `${W} / ${totalH}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = (avatarImg: HTMLImageElement | null) => {
      // 背景：纯色 + 顶部 accent 对角渐变
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, totalH);
      const grad = ctx.createLinearGradient(0, 0, W, totalH * 0.5);
      grad.addColorStop(0, `${accentFrom}33`);
      grad.addColorStop(1, `${accentTo}11`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, totalH);

      // 头部：头像 + 站名 + 会话标题 + 日期
      const cx = PADDING + 52;
      const cy = 108;
      if (avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 52, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImg, cx - 52, cy - 52, 104, 104);
        ctx.restore();
      } else {
        const ag = ctx.createLinearGradient(cx - 52, cy - 52, cx + 52, cy + 52);
        ag.addColorStop(0, accentFrom);
        ag.addColorStop(1, accentTo);
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.arc(cx, cy, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 44px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("喵", cx, cy + 4);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = fg;
      ctx.font = "bold 44px sans-serif";
      ctx.fillText(siteName, cx + 78, cy - 6);
      ctx.fillStyle = muted;
      ctx.font = "28px sans-serif";
      ctx.fillText(title.slice(0, 24), cx + 78, cy + 38);
      ctx.font = "24px sans-serif";
      ctx.fillText(new Date().toLocaleDateString(), PADDING + 4, headerH - 52);

      // 消息气泡：user 右侧 accent 渐变白字，AI 左侧卡片底色
      let y = headerH;
      for (const { m, lines } of laid) {
        const bh = bubbleH(lines.length);
        const bw = Math.min(BUBBLE_MAX, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 48);
        const bx = m.role === "user" ? W - PADDING - bw : PADDING;
        const radius = 28;
        ctx.beginPath();
        ctx.roundRect(bx, y, bw, bh, radius);
        if (m.role === "user") {
          const ug = ctx.createLinearGradient(bx, y, bx + bw, y + bh);
          ug.addColorStop(0, accentFrom);
          ug.addColorStop(1, accentTo);
          ctx.fillStyle = ug;
        } else {
          ctx.fillStyle = cardBg;
        }
        ctx.fill();
        ctx.fillStyle = m.role === "user" ? "#fff" : fg;
        ctx.font = `${fontSize}px sans-serif`;
        lines.forEach((line, i) => {
          ctx.fillText(line, bx + 24, y + 28 + (i + 0.75) * lineHeight - fontSize * 0.35);
        });
        y += bh + 28;
      }

      // 水印
      ctx.fillStyle = muted;
      ctx.font = "26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${siteName} · ${siteUrl}  ❤`, W / 2, totalH - 52);
      ctx.textAlign = "left";
      setReady(true);
    };

    // 头像同源加载（失败回退渐变圆"喵"）
    if (avatar) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => draw(img);
      img.onerror = () => draw(null);
      img.src = avatar;
    } else {
      draw(null);
    }
  }, [open, messages, siteName, avatar, siteUrl, title]);

  if (!open) return null;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(`${title.slice(0, 20) || "chat"}.png`, blob);
    }, "image/png");
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card w-[min(94%,30rem)] overflow-hidden !rounded-3xl !p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{t("chatPage.shareCard")}</p>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-full p-1 text-muted hover:text-rose-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <canvas ref={canvasRef} className="w-full rounded-2xl" />
        <button
          type="button"
          onClick={download}
          disabled={!ready}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-gradient py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {ready ? t("chatPage.downloadPng") : "…"}
        </button>
      </div>
    </div>
  );
}
