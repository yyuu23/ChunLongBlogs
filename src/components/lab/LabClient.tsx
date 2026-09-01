"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useProgress } from "@react-three/drei";
import { Loader2, SendHorizonal, Lock, Sparkles } from "lucide-react";
import { fetchProgress, getVisitorId, trackEvent, type PlayerProgress } from "@/lib/track";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { MomentItem, StarItem, PlanetCounts } from "@/components/lab/LabScene";

/** three.js 场景只在客户端加载（WebGL 不能 SSR） */
const LabScene = dynamic(() => import("@/components/lab/LabScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white/60" />
    </div>
  ),
});

export function LabClient({
  moments,
  initialStars,
  counts,
}: {
  moments: MomentItem[];
  initialStars: StarItem[];
  counts: PlanetCounts;
}) {
  const [stars, setStars] = useState<StarItem[]>(initialStars);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [starInput, setStarInput] = useState("");
  const [starBusy, setStarBusy] = useState(false);
  const [starMsg, setStarMsg] = useState("");

  /** 真实贴图约 1.2MB，加载期间给个进度，别让人以为卡住了 */
  const { active: texLoading, progress: texProgress } = useProgress();

  useEffect(() => {
    // 进实验室计经验 + 拉取进度
    trackEvent("visit_lab");
    fetchProgress().then(setProgress);
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<PlayerProgress>).detail;
      if (detail) setProgress(detail);
    };
    window.addEventListener("cl-player-update", onUpdate);
    return () => window.removeEventListener("cl-player-update", onUpdate);
  }, []);

  const leaveStar = async () => {
    const content = starInput.trim();
    if (!content || starBusy) return;
    setStarBusy(true);
    setStarMsg("");
    try {
      const res = await fetch("/api/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, visitorId: getVisitorId() }),
      });
      const data = (await res.json()) as { star?: StarItem; error?: string };
      if (data.star) {
        setStars((s) => [{ ...data.star!, date: new Date().toLocaleDateString("zh-CN") }, ...s].slice(0, 80));
        setStarInput("");
        setStarMsg("✨ 你的星已汇入小行星带，拖动视角找找它");
        trackEvent("leave_star");
      } else {
        setStarMsg(`❌ ${data.error ?? "失败"}`);
      }
    } catch {
      setStarMsg("❌ 网络异常");
    } finally {
      setStarBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="relative h-[min(78vh,46rem)] w-full overflow-hidden rounded-[2rem] bg-[radial-gradient(ellipse_at_center,#1e1b4b_0%,#0b1020_55%,#05070f_100%)] shadow-2xl">
        <LabScene moments={moments} stars={stars} counts={counts} />

        {/* 等级 HUD */}
        {progress && (
          <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white backdrop-blur">
            <p className="flex items-center gap-2 text-sm font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-gradient text-xs font-black">
                Lv.{progress.level}
              </span>
              {progress.title}
              <span className="text-xs font-normal text-white/50">{progress.xp} XP</span>
            </p>
            <div className="mt-1.5 h-1.5 w-44 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-accent-gradient transition-all duration-700"
                style={{ width: `${Math.round(progress.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* 留星表单 */}
        <div className="absolute bottom-4 left-1/2 w-[min(30rem,88%)] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/55 px-3 py-2 backdrop-blur">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
            <input
              value={starInput}
              maxLength={50}
              onChange={(e) => setStarInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && leaveStar()}
              placeholder="留下一句话，化作夜空中永久的星（50 字内）"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
            <span className="shrink-0 text-[10px] tabular-nums text-white/35">{starInput.length}/50</span>
            <button
              onClick={leaveStar}
              disabled={starBusy || !starInput.trim()}
              aria-label="留星"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white disabled:opacity-40"
            >
              {starBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizonal className="h-3.5 w-3.5" />}
            </button>
          </div>
          {starMsg && <p className="mt-1.5 text-center text-xs text-white/70">{starMsg}</p>}
        </div>

        <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
          {texLoading && (
            <p className="flex items-center gap-1 text-[11px] tabular-nums text-white/60">
              <Loader2 className="h-3 w-3 animate-spin" />
              加载行星贴图 {Math.round(texProgress)}%
            </p>
          )}
          <p className="text-[11px] tracking-widest text-white/35">拖拽旋转 · 滚轮缩放</p>
        </div>
      </div>

      {/* 成就徽章墙 */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
            <Sparkles className="h-4 w-4 text-accent" /> 成就徽章
          </h2>
          {progress && (
            <span className="text-xs text-muted">
              {progress.achievements.length} / {ACHIEVEMENTS.length} 已解锁
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
          {ACHIEVEMENTS.map((a, i) => {
            const unlocked = progress?.achievements.includes(a.key) ?? false;
            const tier = progress?.tier ?? "bronze";
            return (
              <motion.div
                key={a.key}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                title={`${a.name}：${a.description}`}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition-all ${
                  unlocked ? "bg-accent-soft" : "opacity-45"
                }`}
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center text-xl ${
                    unlocked ? "hex-badge" : ""
                  }`}
                  style={
                    unlocked
                      ? tier === "gold"
                        ? { background: "linear-gradient(135deg,#fbbf24,#f97316)", color: "#fff" }
                        : tier === "silver"
                          ? { background: "linear-gradient(135deg,#cbd5e1,#94a3b8)", color: "#fff" }
                          : { background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff" }
                      : undefined
                  }
                >
                  {unlocked ? a.emoji : <Lock className="h-4 w-4 text-muted" />}
                </span>
                <span className="text-[11px] font-medium leading-tight">{a.name}</span>
                <span className="hidden text-[10px] leading-tight text-muted sm:block">{a.description}</span>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-muted">
          读文章、听音乐、换主题色、发现彩蛋、留声星……你的每一次探索都会累积经验（进度已永久保存在服务器）
        </p>
      </div>
    </div>
  );
}
