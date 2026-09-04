"use client";

import type { PlayerStats, XpEvent } from "@/lib/achievements";

const VID_KEY = "cl-visitor-id";

/** 匿名访客 ID：localStorage UUID（服务端用它永久保存进度） */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(VID_KEY);
  if (!id) {
    id =
      (crypto.randomUUID?.() ??
        `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`).slice(0, 64);
    localStorage.setItem(VID_KEY, id);
  }
  return id;
}

export interface PlayerProgress {
  xp: number;
  level: number;
  title: string;
  progress: number;
  tier: string;
  achievements: string[];
  /** API 响应本来就带 stats（成就进度展示用），此前类型没声明 */
  stats: PlayerStats;
}

/**
 * 解析当前"实际生效"的粒子主题：auto/season 在客户端展开成具体主题
 * （与 Effects.tsx 的判定口径一致），供服务端给瓶子记录获得时的季节。
 */
export function currentParticleTheme(): string {
  try {
    const saved = localStorage.getItem("cl-particle-theme");
    const theme = saved && saved !== "off" ? saved : "auto";
    if (theme === "auto") {
      return matchMedia("(prefers-color-scheme: dark)").matches ? "firefly" : "sakura";
    }
    if (theme === "season") {
      const m = new Date().getMonth() + 1;
      return m >= 3 && m <= 5 ? "sakura" : m >= 6 && m <= 8 ? "firefly" : m >= 9 && m <= 11 ? "leaf" : "snow";
    }
    return theme;
  } catch {
    return "sakura";
  }
}

/** 行为埋点：fire-and-forget 上报经验事件，附带本地事件供 HUD 即时刷新 */
export function trackEvent(event: XpEvent, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const visitorId = getVisitorId();
  // 本地去重：同一文章阅读/彩蛋/实验室只报一次（简单节流）
  const onceKey = `cl-once-${event}-${payload?.postId ?? payload?.accent ?? ""}`;
  if (["read_post", "find_egg"].includes(event)) {
    if (event === "read_post") {
      try {
        const read = new Set(JSON.parse(localStorage.getItem("cl-read-posts") ?? "[]") as number[]);
        const pid = Number(payload?.postId);
        if (read.has(pid)) return;
        read.add(pid);
        localStorage.setItem("cl-read-posts", JSON.stringify([...read].slice(-100)));
      } catch {}
    }
  }
  void onceKey;

  fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId, event, payload, __meta: { theme: currentParticleTheme() } }),
    // 页面即将卸载（如点行星外链跳走）时也别丢上报
    keepalive: true,
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: PlayerProgress | null) => {
      if (data) window.dispatchEvent(new CustomEvent("cl-player-update", { detail: data }));
    })
    .catch(() => {});
}

/** 查询当前进度（HUD 初始化用） */
export async function fetchProgress(): Promise<PlayerProgress | null> {
  if (typeof window === "undefined") return null;
  try {
    const r = await fetch(`/api/player?visitorId=${encodeURIComponent(getVisitorId())}`);
    return r.ok ? ((await r.json()) as PlayerProgress) : null;
  } catch {
    return null;
  }
}
