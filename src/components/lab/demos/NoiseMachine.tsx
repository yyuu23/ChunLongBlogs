"use client";

import { useEffect, useRef, useState } from "react";
import { MoonStar, Volume2 } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import {
  NOISE_CHANNELS,
  noiseAnalyser,
  noiseFadeOutAll,
  noiseOnChannelStatus,
  noisePlay,
  noiseSetChannelVolume,
  noiseSetMasterVolume,
  noiseStop,
  noiseStopAll,
  type NoiseChannelId,
} from "@/lib/noise-audio";
import { accentColor } from "@/lib/demo-utils";

/**
 * 白噪音机（/lab/noise）：点上几个场景，调出自己的专注背景音。
 *
 * - 场景：白/粉/棕（实时合成，零下载）+ 雨/篝火/夜虫/溪流/森林/海浪
 *   （真实采样，首次点击按需加载、无缝循环，失败只影响该场景）；
 * - 可多场景叠加，每通道独立音量 + 总音量；
 * - 睡眠定时：15/30/60 分钟后 8 秒渐弱停止；
 * - 可视化：AnalyserNode 频谱的对称条形（reduced-motion 不渲染）；
 * - 离开页面即停（unmount → noiseStopAll）；document.hidden 停 rAF。
 */

const SCENE_EMOJI: Record<NoiseChannelId, string> = {
  white: "⚪",
  pink: "🌸",
  brown: "🌰",
  rain: "🌧️",
  fire: "🔥",
  crickets: "🦗",
  stream: "💧",
  forest: "🌲",
  waves: "🌊",
};

const TIMER_OPTIONS = [0, 15, 30, 60] as const;

export default function NoiseMachine() {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState<Partial<Record<NoiseChannelId, number>>>({});
  const [masterVol, setMasterVol] = useState(0.8);
  const [timerMin, setTimerMin] = useState<(typeof TIMER_OPTIONS)[number]>(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remainMin, setRemainMin] = useState(0);
  const [failed, setFailed] = useState<Set<NoiseChannelId>>(new Set());

  const sceneName = (id: NoiseChannelId) => {
    const map: Record<NoiseChannelId, string> = {
      white: t("lab.noiseWhite"),
      pink: t("lab.noisePink"),
      brown: t("lab.noiseBrown"),
      rain: t("lab.noiseRain"),
      fire: t("lab.noiseFire"),
      crickets: t("lab.noiseCrickets"),
      stream: t("lab.noiseStream"),
      forest: t("lab.noiseForest"),
      waves: t("lab.noiseWaves"),
    };
    return map[id];
  };

  const toggle = (id: NoiseChannelId) => {
    if (active[id] != null) {
      noiseStop(id);
      setActive((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setFailed((prev) => {
        if (!prev.has(id)) return prev;
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
      noisePlay(id, 0.7);
      setActive((prev) => ({ ...prev, [id]: 0.7 }));
    }
  };

  const changeChannelVol = (id: NoiseChannelId, v: number) => {
    noiseSetChannelVolume(id, v);
    setActive((prev) => ({ ...prev, [id]: v }));
  };

  const changeMaster = (v: number) => {
    setMasterVol(v);
    noiseSetMasterVolume(v);
  };

  const chooseTimer = (min: (typeof TIMER_OPTIONS)[number]) => {
    setTimerMin(min);
    if (min === 0) {
      setDeadline(null);
      setRemainMin(0);
      return;
    }
    const at = Date.now() + min * 60_000;
    setDeadline(at);
    setRemainMin(min);
  };

  /* 素材通道状态：失败 → 场景卡上标记 + 顶部提示一次 */
  useEffect(
    () =>
      noiseOnChannelStatus((id, state) => {
        if (state === "failed") setFailed((prev) => new Set([...prev, id]));
      }),
    [],
  );

  /* 睡眠定时：到点 8s 渐弱全停；每 30s 刷新剩余分钟显示 */
  useEffect(() => {
    if (deadline == null) return;
    const fire = setTimeout(() => {
      noiseFadeOutAll(8);
      setDeadline(null);
      setTimerMin(0);
      setRemainMin(0);
      setActive({});
    }, Math.max(0, deadline - Date.now()));
    const tick = setInterval(() => {
      setRemainMin(Math.max(0, Math.ceil((deadline - Date.now()) / 60_000)));
    }, 30_000);
    setRemainMin(Math.max(0, Math.ceil((deadline - Date.now()) / 60_000)));
    return () => {
      clearTimeout(fire);
      clearInterval(tick);
    };
  }, [deadline]);

  /* 可视化：AnalyserNode 频谱对称条形（reduced-motion 不渲染） */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const accent = accentColor("rgb(129,140,248)");

    let w = 0;
    let h = 0;
    let raf = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const BARS = 48;
    const bins = new Uint8Array(128);
    const levels = new Array<number>(BARS).fill(0);
    const tick = () => {
      const an = noiseAnalyser();
      ctx.clearRect(0, 0, w, h);
      if (an) an.getByteFrequencyData(bins);
      const mid = h / 2;
      const barW = w / (BARS * 1.5);
      const gap = barW * 0.5;
      for (let i = 0; i < BARS; i++) {
        // 低频在左；频谱取前 96 bins 按对数感分布
        const v = an ? bins[Math.floor(Math.pow(i / BARS, 1.4) * 96)]! / 255 : 0;
        levels[i] = levels[i]! * 0.7 + v * 0.3; // 平滑
        const barH = Math.max(2, levels[i]! * (h * 0.42));
        const x = i * (barW + gap);
        ctx.globalAlpha = 0.35 + levels[i]! * 0.65;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.roundRect(x, mid - barH / 2, barW, barH, barW / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onVisibility = () => {
      if (!document.hidden && raf === 0) raf = requestAnimationFrame(tick);
      else if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* 离开页面必须安静 */
  useEffect(() => () => noiseStopAll(), []);

  const failedOne = failed.size ? [...failed][0] : null;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#0c1122_0%,#131a33_60%,#1a2140_100%)] shadow-2xl">
      {/* 可视化区（reduced-motion 时退化为纯渐变） */}
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
        <p className="pointer-events-none absolute inset-x-0 top-[42%] text-center text-sm tracking-widest text-white/45">
          {t("lab.noiseHint")}
        </p>
        {failedOne && (
          <p className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full border border-amber-300/25 bg-slate-950/70 px-3 py-1 text-[11px] text-amber-200/90 backdrop-blur">
            {t("lab.noiseSceneFail", { name: sceneName(failedOne) })}
          </p>
        )}
        {deadline != null && (
          <p className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-indigo-300/25 bg-slate-950/70 px-3 py-1 text-[11px] tabular-nums text-indigo-200/90 backdrop-blur">
            <MoonStar className="h-3 w-3" />
            {t("lab.noiseTimerLeft", { n: remainMin })}
          </p>
        )}
      </div>

      {/* 控制面板 */}
      <div className="shrink-0 border-t border-white/10 bg-slate-950/45 p-4 backdrop-blur">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {NOISE_CHANNELS.map((def) => {
            const on = active[def.id] != null;
            const isFailed = failed.has(def.id);
            return (
              <button
                key={def.id}
                onClick={() => toggle(def.id)}
                aria-pressed={on}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-[11px] transition-colors ${
                  on
                    ? "border-transparent bg-accent-gradient text-white shadow-lg"
                    : isFailed
                      ? "border-amber-300/30 bg-white/5 text-amber-200/60"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
                }`}
              >
                <span className={`text-lg ${on ? "animate-pulse" : ""}`}>{SCENE_EMOJI[def.id]}</span>
                {sceneName(def.id)}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* 活动通道混音 */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5">
            {(Object.keys(active) as NoiseChannelId[]).map((id) => (
              <label key={id} className="flex items-center gap-1.5 text-[11px] text-white/70">
                <span className="w-14 shrink-0 truncate">{sceneName(id)}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((active[id] ?? 0.7) * 100)}
                  onChange={(e) => changeChannelVol(id, Number(e.target.value) / 100)}
                  aria-label={sceneName(id)}
                  className="h-1 w-20 cursor-pointer accent-indigo-300"
                />
              </label>
            ))}
            {Object.keys(active).length === 0 && (
              <span className="text-[11px] text-white/35">{t("lab.noiseMixEmpty")}</span>
            )}
          </div>

          {/* Master + 定时器 */}
          <label className="flex items-center gap-1.5 text-[11px] text-white/70">
            <Volume2 className="h-3.5 w-3.5 text-accent" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(masterVol * 100)}
              onChange={(e) => changeMaster(Number(e.target.value) / 100)}
              aria-label={t("lab.noiseMaster")}
              className="h-1 w-24 cursor-pointer accent-indigo-300"
            />
          </label>
          <div className="flex items-center gap-1 text-[11px] text-white/70" role="group" aria-label={t("lab.noiseTimer")}>
            <MoonStar className="h-3.5 w-3.5 text-accent" />
            {TIMER_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => chooseTimer(m)}
                aria-pressed={timerMin === m}
                className={`rounded-full px-2 py-0.5 transition-colors ${
                  timerMin === m ? "bg-accent-gradient text-white" : "text-white/55 hover:text-white"
                }`}
              >
                {m === 0 ? t("lab.noiseTimerOff") : `${m}m`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
