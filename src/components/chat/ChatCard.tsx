"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * 站内原生富卡片：AI 用 ```chat-card JSON 输出，ChatMarkdown 的 pre 渲染器
 * 解析后分发到这里。解析失败降级为普通代码块，流式未闭合时显示占位。
 * 卡片数据由模型从工具查询结果带出（提示词已要求禁止编造）。
 */

/* ---------- 数据形态（模型输出，全部按不可信输入做宽松清洗） ---------- */

interface PostCardItem {
  title: string;
  slug?: string;
  date?: string;
  category?: string;
  description?: string;
  cover?: string;
  pinned?: boolean;
}
interface MomentCardItem {
  content: string;
  date?: string;
  mood?: string;
  location?: string;
  image?: string;
}
interface AlbumCardItem {
  title: string;
  description?: string;
  cover?: string;
  photoCount?: number;
  createdAt?: string;
}
interface StatCardItem {
  label: string;
  value: number | string;
  unit?: string;
  icon?: string;
}
interface VsSide {
  name: string;
  points?: string[];
}
interface VsCardData {
  left: VsSide;
  right: VsSide;
  verdict?: string;
}

const str = (v: unknown, max = 300) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/* ---------- 数字滚动（尊重系统减动效设置） ---------- */

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0 || !Number.isFinite(value)) {
      setDisplay(value || 0);
      return;
    }
    const duration = 800;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

/* ---------- 各卡片 ---------- */

function PostsCard({ items }: { items: PostCardItem[] }) {
  return (
    <div className="my-2 grid gap-2 sm:grid-cols-2">
      {items.map((p, i) => (
        <Link
          key={i}
          href={p.slug ? `/posts/${p.slug}` : "/posts"}
          className="glass-card glass-hover group block overflow-hidden !rounded-xl transition-transform hover:-translate-y-0.5"
        >
          {p.cover ? (
            // 封面可能是任意外链/上传路径，统一走原生 img + 懒加载
            <img src={p.cover} alt={p.title} loading="lazy" className="aspect-video w-full object-cover" />
          ) : (
            <div className="aspect-video w-full bg-accent-gradient opacity-75" />
          )}
          <div className="p-2.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-snug">
              {p.pinned && <span title="置顶">📌</span>}
              <span className="truncate group-hover:text-accent">{p.title}</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted">
              {p.category && (
                <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-accent">{p.category}</span>
              )}
              {p.date && <span>{p.date}</span>}
            </p>
            {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.description}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}

function MomentsCard({ items }: { items: MomentCardItem[] }) {
  return (
    <div className="my-2">
      {items.map((m, i) => (
        <div key={i} className="relative flex gap-2.5 py-2">
          {i < items.length - 1 && (
            <span className="absolute top-9 left-[0.6875rem] h-[calc(100%-1.25rem)] w-px bg-[var(--glass-border)]" />
          )}
          <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm shadow-sm dark:bg-white/15">
            {m.mood || "💭"}
          </span>
          <div className="min-w-0 flex-1 rounded-xl bg-white/40 px-3 py-2 dark:bg-white/10">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-muted">
              {m.date && <span>{m.date}</span>}
              {m.location && <span>📍 {m.location}</span>}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap">{m.content}</p>
            {m.image && (
              <img
                src={m.image}
                alt=""
                loading="lazy"
                className="mt-1.5 max-h-32 rounded-lg object-cover"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlbumsCard({ items }: { items: AlbumCardItem[] }) {
  return (
    <div className="my-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map((a, i) => (
        // 轻微旋转模拟拍立得随手放的感觉
        <div
          key={i}
          className="glass-card overflow-hidden !rounded-lg"
          style={{ transform: `rotate(${((i % 3) - 1) * 1.2}deg)` }}
        >
          {a.cover ? (
            <img src={a.cover} alt={a.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="aspect-[4/3] w-full bg-accent-gradient opacity-60" />
          )}
          <div className="p-2">
            <p className="truncate text-xs font-semibold">{a.title}</p>
            <p className="mt-0.5 text-[0.6875rem] text-muted">
              📷 {a.photoCount ?? "?"} 张{a.createdAt ? ` · ${a.createdAt}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsCard({ items }: { items: StatCardItem[] }) {
  return (
    <div className="my-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((s, i) => (
        <div key={i} className="glass-card flex flex-col items-center gap-0.5 !rounded-xl px-2 py-3">
          <span className="text-lg leading-none">{s.icon || "📊"}</span>
          <p className="mt-1 text-lg leading-tight font-bold text-accent">
            {typeof s.value === "number" ? <CountUp value={s.value} /> : s.value}
            {s.unit && <span className="ml-0.5 text-xs font-medium">{s.unit}</span>}
          </p>
          <p className="text-[0.6875rem] text-muted">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function VsSideBlock({ side, win }: { side: VsSide; win: boolean }) {
  return (
    <div className="flex min-w-0 flex-col p-3">
      <p className={`text-sm font-bold ${win ? "text-accent" : ""}`}>{side.name}</p>
      {side.points?.length ? (
        <ul className="mt-1.5 space-y-1">
          {side.points.map((p, i) => (
            <li key={i} className="flex gap-1.5 text-xs leading-relaxed">
              <span className={win ? "text-accent" : "text-muted"}>•</span>
              <span className="min-w-0">{p}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function VsCard({ left, right, verdict }: VsCardData) {
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-[var(--glass-border)]">
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        <div className="bg-white/40 dark:bg-white/5">
          <VsSideBlock side={left} win={true} />
        </div>
        <div className="flex items-center justify-center bg-accent-gradient px-2.5 text-xs font-black tracking-widest text-white">
          VS
        </div>
        <div className="bg-white/40 dark:bg-white/5">
          <VsSideBlock side={right} win={false} />
        </div>
      </div>
      {verdict && (
        <p className="border-t border-[var(--glass-border)] bg-white/40 px-3 py-2 text-xs leading-relaxed dark:bg-white/10">
          🏁 {verdict}
        </p>
      )}
    </div>
  );
}

/* ---------- 入口：解析 JSON 并分发；异常一律降级 ---------- */

function FallbackCode({ code }: { code: string }) {
  return (
    <pre className="my-2 overflow-x-auto rounded-xl bg-black/80 p-3 text-[0.75rem] leading-relaxed text-rose-200">
      <code>{code}</code>
    </pre>
  );
}

function CardPlaceholder() {
  return (
    <div className="my-2 flex items-center gap-2 rounded-xl border border-dashed border-[var(--glass-border)] bg-white/30 px-3 py-3 text-xs text-muted dark:bg-white/10">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      🎨 卡片生成中…
    </div>
  );
}

export function ChatCardBlock({ code, streaming }: { code: string; streaming?: boolean }): ReactNode {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(code) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [code]);

  if (streaming) return <CardPlaceholder />;
  if (!parsed || typeof parsed !== "object") return <FallbackCode code={code} />;

  const rawItems = Array.isArray(parsed.items) ? (parsed.items as unknown[]) : [];

  switch (parsed.type) {
    case "posts": {
      const items = rawItems
        .map((it) => it as Record<string, unknown>)
        .filter((it) => str(it.title))
        .slice(0, 8)
        .map<PostCardItem>((it) => ({
          title: str(it.title, 120)!,
          slug: str(it.slug, 128),
          date: str(it.date, 20),
          category: str(it.category, 30),
          description: str(it.description, 160),
          cover: str(it.cover, 500),
          pinned: it.pinned === true,
        }));
      return items.length ? <PostsCard items={items} /> : <FallbackCode code={code} />;
    }
    case "moments": {
      const items = rawItems
        .map((it) => it as Record<string, unknown>)
        .filter((it) => str(it.content))
        .slice(0, 10)
        .map<MomentCardItem>((it) => ({
          content: str(it.content, 400)!,
          date: str(it.date, 20),
          mood: str(it.mood, 8),
          location: str(it.location, 40),
          image: str(it.image, 500),
        }));
      return items.length ? <MomentsCard items={items} /> : <FallbackCode code={code} />;
    }
    case "albums": {
      const items = rawItems
        .map((it) => it as Record<string, unknown>)
        .filter((it) => str(it.title))
        .slice(0, 9)
        .map<AlbumCardItem>((it) => ({
          title: str(it.title, 80)!,
          description: str(it.description, 120),
          cover: str(it.cover, 500),
          photoCount: num(it.photoCount),
          createdAt: str(it.createdAt, 20),
        }));
      return items.length ? <AlbumsCard items={items} /> : <FallbackCode code={code} />;
    }
    case "stats": {
      const items = rawItems
        .map((it) => it as Record<string, unknown>)
        .filter((it) => str(it.label) && (num(it.value) !== undefined || str(it.value, 40)))
        .slice(0, 9)
        .map<StatCardItem>((it) => ({
          label: str(it.label, 30)!,
          value: num(it.value) !== undefined ? num(it.value)! : str(it.value, 40)!,
          unit: str(it.unit, 10),
          icon: str(it.icon, 8),
        }));
      return items.length ? <StatsCard items={items} /> : <FallbackCode code={code} />;
    }
    case "vs": {
      const raw = parsed as unknown as {
        left?: Record<string, unknown>;
        right?: Record<string, unknown>;
        verdict?: unknown;
      };
      const toSide = (s: Record<string, unknown> | undefined): VsSide | null => {
        const name = str(s?.name, 60);
        if (!name) return null;
        const points = Array.isArray(s?.points)
          ? (s.points as unknown[])
              .map((p) => str(p, 120))
              .filter((p): p is string => !!p)
              .slice(0, 6)
          : [];
        return { name, points };
      };
      const left = toSide(raw.left);
      const right = toSide(raw.right);
      if (!left || !right) return <FallbackCode code={code} />;
      return <VsCard left={left} right={right} verdict={str(raw.verdict, 200)} />;
    }
    default:
      return <FallbackCode code={code} />;
  }
}
