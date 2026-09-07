"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Download, FileJson, FileSpreadsheet, FileText, Loader2, Music2 } from "lucide-react";

/**
 * Admin 数据统计面板：概览卡 + 流量趋势（PV 柱 / UV 线）+ AI 使用（环形/条形/工具）
 * + 音乐 TOP + 内容资产 + 四格式导出。图表自绘 SVG，零第三方依赖。
 */

export interface StatsPayload {
  generatedAt: string;
  range: number;
  overview: {
    todayUV: number;
    yesterdayUV: number;
    todayPV: number;
    yesterdayPV: number;
    uvTotal: number;
    aiToday: number;
    aiTotal: number;
    musicTotal: number;
    imgTotal: number;
  };
  traffic: { day: string; pv: number; uv: number }[];
  aiCalls: { key: string; provider: string; model: string; effort: string; count: number }[];
  aiTools: { key: string; count: number }[];
  topPages: { key: string; count: number }[];
  musicTop: { key: string; count: number }[];
  content: {
    postsPublished: number;
    postsDrafts: number;
    postViews: number;
    postWords: number;
    moments: number;
    albums: number;
    photos: number;
    playlists: number;
    songs: number;
    friends: number;
    stars: number;
  };
}

const card = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm";
const nf = (n: number) => n.toLocaleString("zh-CN");

function CountNum({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0) {
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setDisplay(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="tabular-nums">{nf(display)}</span>;
}

/* ---------- 流量趋势：PV 柱 + UV 线（SVG 自绘，悬停显示数值） ---------- */
function TrafficChart({ data }: { data: StatsPayload["traffic"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = 240;
  const padL = 36;
  const padB = 26;
  const padT = 14;
  const maxPv = Math.max(...data.map((d) => d.pv), 5);
  const maxUv = Math.max(...data.map((d) => d.uv), 3);
  const innerW = W - padL - 12;
  const innerH = H - padB - padT;
  const step = innerW / Math.max(data.length, 1);
  const barW = Math.max(3, step * 0.55);
  const x = (i: number) => padL + step * (i + 0.5);
  const yPv = (v: number) => padT + innerH - (v / maxPv) * innerH;
  const yUv = (v: number) => padT + innerH - (v / maxUv) * innerH;
  const uvLine = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yUv(d.uv).toFixed(1)}`).join(" ");
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="流量趋势图">
        <defs>
          <linearGradient id="pvBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* 网格与 Y 轴刻度（左 PV） */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const v = Math.round(maxPv * r);
          return (
            <g key={r}>
              <line x1={padL} x2={W - 12} y1={yPv(v)} y2={yPv(v)} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padL - 6} y={yPv(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {v}
              </text>
            </g>
          );
        })}
        {/* PV 柱 */}
        {data.map((d, i) => (
          <rect
            key={`b${i}`}
            x={x(i) - barW / 2}
            y={yPv(d.pv)}
            width={barW}
            height={Math.max(0, padT + innerH - yPv(d.pv))}
            rx="2"
            fill="url(#pvBar)"
            opacity={hover === null || hover === i ? 1 : 0.45}
          />
        ))}
        {/* UV 线 */}
        <path d={uvLine} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={`c${i}`} cx={x(i)} cy={yUv(d.uv)} r="2.5" fill="#f43f5e" />
        ))}
        {/* X 轴日期（稀疏） */}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={`x${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
              {d.day.slice(5)}
            </text>
          ) : null,
        )}
        {/* 悬停命中区 */}
        {data.map((d, i) => (
          <rect
            key={`h${i}`}
            x={x(i) - step / 2}
            y={padT}
            width={step}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {/* 图例 + tooltip */}
      <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-gradient-to-b from-indigo-500 to-purple-400" /> PV
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-0.5 w-4 rounded bg-rose-500" /> UV
        </span>
        {hover !== null && data[hover] && (
          <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[0.6875rem] text-slate-500">
            {data[hover].day} · PV {nf(data[hover].pv)} · UV {nf(data[hover].uv)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- 供应商占比环形图 ---------- */
function ProviderDonut({ aiCalls }: { aiCalls: StatsPayload["aiCalls"] }) {
  const byProvider = new Map<string, number>();
  for (const a of aiCalls) byProvider.set(a.provider, (byProvider.get(a.provider) ?? 0) + a.count);
  const entries = [...byProvider.entries()].sort((x, y) => y[1] - x[1]);
  const total = entries.reduce((s, e) => s + e[1], 0);
  const colors: Record<string, string> = { glm: "#3859FF", deepseek: "#4D6BFE", qwen: "#7C3AED" };
  const names: Record<string, string> = { glm: "GLM", deepseek: "DeepSeek", qwen: "Qwen" };
  let acc = 0;
  const R = 52;
  const C = 2 * Math.PI * R;

  if (!total) return <p className="py-8 text-center text-xs text-slate-400">暂无 AI 调用数据</p>;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0">
        {entries.map(([p, n]) => {
          const frac = n / total;
          const dash = `${(frac * C).toFixed(2)} ${C}`;
          const offset = -acc * C;
          acc += frac;
          return (
            <circle
              key={p}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={colors[p] ?? "#94a3b8"}
              strokeWidth="16"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
            />
          );
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="18" fontWeight="700" fill="#334155">
          {nf(total)}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="9" fill="#94a3b8">
          总调用
        </text>
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {entries.map(([p, n]) => (
          <div key={p} className="flex items-center gap-2 text-xs">
            <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[p] ?? "#94a3b8" }} />
            <span className="w-16 shrink-0 font-medium text-slate-600">{names[p] ?? p}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${(n / total) * 100}%`, background: colors[p] ?? "#94a3b8" }} />
            </div>
            <span className="w-20 shrink-0 text-right tabular-nums text-slate-400">
              {nf(n)} · {((n / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 通用横向条形列表 ---------- */
function HBars({
  items,
  empty,
  unit = "",
  colorful = false,
}: {
  items: { key: string; count: number }[];
  empty: string;
  unit?: string;
  colorful?: boolean;
}) {
  if (!items.length) return <p className="py-4 text-center text-xs text-slate-400">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  const palette = ["bg-indigo-400", "bg-purple-400", "bg-rose-400", "bg-amber-400", "bg-emerald-400"];
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.key + i} className="flex items-center gap-2 text-xs">
          <span className="w-44 shrink-0 truncate text-slate-600" title={it.key}>
            {it.key || "—"}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${colorful ? palette[i % palette.length] : "bg-accent-gradient"}`}
              style={{ width: `${(it.count / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right tabular-nums text-slate-400">
            {nf(it.count)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

const EFFORT_ZH: Record<string, string> = { off: "无", low: "低", mid: "中", high: "高", max: "最高", on: "开" };

export function StatsDashboard({ initial }: { initial: StatsPayload }) {
  const [data, setData] = useState(initial);
  const [range, setRange] = useState(initial.range);
  const [loading, setLoading] = useState(false);

  const load = async (r: number) => {
    setRange(r);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?range=${r}`);
      if (res.ok) setData((await res.json()) as StatsPayload);
    } catch {}
    setLoading(false);
  };

  const o = data.overview;
  const c = data.content;
  const exportUrl = (format: string) => `/api/admin/stats?range=${range}&format=${format}`;

  return (
    <div className={`space-y-5 ${loading ? "opacity-60" : ""}`}>
      {/* 时间范围 + 导出 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {[7, 30, 90].map((r) => (
            <button
              key={r}
              onClick={() => load(r)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                range === r ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white" : "text-slate-500 hover:text-indigo-600"
              }`}
            >
              近 {r} 天
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={exportUrl("zip")} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-3.5 py-2 text-xs font-medium text-white shadow-md shadow-indigo-500/20">
            <Download className="h-3.5 w-3.5" /> ZIP 全量包
          </a>
          <a href={exportUrl("md")} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-50">
            <FileText className="h-3.5 w-3.5" /> Markdown
          </a>
          <a href={exportUrl("csv")} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-50">
            <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
          </a>
          <a href={exportUrl("json")} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-50">
            <FileJson className="h-3.5 w-3.5" /> JSON
          </a>
        </div>
      </div>

      {/* 概览卡 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "今日访客 UV", value: o.todayUV, sub: `昨日 ${nf(o.yesterdayUV)}` },
          { label: "今日浏览 PV", value: o.todayPV, sub: `昨日 ${nf(o.yesterdayPV)}` },
          { label: "累计独立访客", value: o.uvTotal, sub: "按匿名 ID 去重" },
          { label: "AI 调用（今日）", value: o.aiToday, sub: `累计 ${nf(o.aiTotal)} · 带图 ${nf(o.imgTotal)}` },
          { label: "音乐播放（累计）", value: o.musicTotal, sub: "全站播放器" },
        ].map((k) => (
          <div key={k.label} className={card}>
            <p className="text-[0.6875rem] text-slate-400">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">
              <CountNum value={k.value} />
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-slate-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* 流量趋势 */}
      <section className={card}>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          流量趋势（PV / UV）
        </h2>
        <TrafficChart data={data.traffic} />
      </section>

      {/* AI 使用 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">🤖 供应商调用占比</h2>
          <ProviderDonut aiCalls={data.aiCalls} />
        </section>
        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold">🎛️ 模型 × 思考档位</h2>
          <HBars
            items={data.aiCalls.map((a) => ({
              key: `${a.model || a.provider} · ${EFFORT_ZH[a.effort] ?? a.effort}`,
              count: a.count,
            }))}
            empty="暂无 AI 调用数据（发起对话后开始累计）"
            colorful
          />
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold">🧰 AI 工具调用</h2>
          <HBars items={data.aiTools} empty="暂无工具调用" />
        </section>
        <section className={card}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Music2 className="h-4 w-4 text-rose-400" />
            音乐播放 TOP
          </h2>
          <HBars items={data.musicTop} empty="暂无播放记录" unit=" 次" />
        </section>
      </div>

      {/* 内容资产 + 热门页面 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold">📚 内容资产</h2>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {[
              ["文章（发布）", c.postsPublished],
              ["草稿", c.postsDrafts],
              ["文章总浏览", c.postViews],
              ["总字数", c.postWords],
              ["说说", c.moments],
              ["相册", c.albums],
              ["照片", c.photos],
              ["歌单", c.playlists],
              ["歌曲", c.songs],
              ["友链", c.friends],
              ["访客留星", c.stars],
            ].map(([label, v]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[0.625rem] text-slate-400">{label}</p>
                <p className="mt-0.5 text-base font-bold text-slate-700 tabular-nums">{nf(Number(v))}</p>
              </div>
            ))}
          </div>
        </section>
        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold">🔥 热门页面</h2>
          <HBars items={data.topPages} empty="暂无页面浏览数据" />
        </section>
      </div>

      <p className="px-1 text-[0.6875rem] leading-relaxed text-slate-400">
        口径：UV 按匿名访客 ID 当日去重；PV 为页面浏览（同会话同路径 30 秒去重）；AI 调用含全部供应商与思考档位。
        数据按天聚合存储（约 1MB/年），不含 IP、UA 等个人信息。导出文件名含日期戳，ZIP 内含 JSON/CSV/MD 三份。
        数据自统计功能上线起累积。
      </p>
    </div>
  );
}
