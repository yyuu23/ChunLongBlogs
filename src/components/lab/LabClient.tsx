"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/** three.js 场景只在客户端加载（WebGL 不能 SSR） */
const LabScene = dynamic(() => import("@/components/lab/LabScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white/60" />
    </div>
  ),
});

export function LabClient() {
  return (
    <div className="relative h-[min(78vh,46rem)] w-full overflow-hidden rounded-[2rem] bg-[radial-gradient(ellipse_at_center,#1e1b4b_0%,#0b1020_55%,#05070f_100%)] shadow-2xl">
      <LabScene />
      <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs tracking-widest text-white/50">
        拖拽旋转 · 滚轮缩放 · 点击晶体触发星屑爆发
      </p>
    </div>
  );
}
