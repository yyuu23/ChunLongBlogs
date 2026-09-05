"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Music2, Clock3, ListMusic, Heart, Headphones } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/components/music/PlayerProvider";
import { useT, useLocale } from "@/components/providers/LocaleProvider";
import { loadFavorites, toggleFavorite, subscribeFavorites } from "@/lib/favorites";
import { parseLrc } from "@/lib/lrc";
import { fetchProgress, type PlayerProgress } from "@/lib/track";
import { achievementProgress } from "@/lib/achievements";
import { MUSIC } from "@/lib/achievements-data";
import { pick } from "@/lib/i18n/config";

export interface MusicPlaylist {
  id: number;
  title: string;
  description: string;
  cover: string;
  songs: {
    id: number;
    title: string;
    artist: string;
    cover: string;
    url: string;
    duration: number;
    lrc: string;
  }[];
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function MusicClient({ playlists }: { playlists: MusicPlaylist[] }) {
  const player = usePlayer();
  const t = useT();
  const [activeId, setActiveId] = useState<number | null>(playlists[0]?.id ?? null);
  const [recent, setRecent] = useState<PlayerSong[]>([]);
  const [favs, setFavs] = useState<PlayerSong[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cl-recent-songs");
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
    const onStorage = () => {
      try {
        setRecent(JSON.parse(localStorage.getItem("cl-recent-songs") ?? "[]"));
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 收藏列表：挂载读取 + 订阅迷你播放条/其它标签页的红心变化
  useEffect(() => {
    setFavs(loadFavorites());
    return subscribeFavorites(setFavs);
  }, []);

  const active = playlists.find((p) => p.id === activeId) ?? null;
  const toPlayerSong = (s: MusicPlaylist["songs"][number]): PlayerSong => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    cover: s.cover,
    url: s.url,
    lrc: s.lrc,
  });
  const isFav = (id: number) => favs.some((f) => f.id === id);

  return (
    <div className="mx-auto grid w-[min(96%,64rem)] gap-6 lg:grid-cols-[20rem_1fr]">
      {/* 左：歌单列表 */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {playlists.map((pl, i) => (
            <motion.button
              key={pl.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setActiveId(pl.id)}
              className={`glass-card glass-hover flex items-center gap-3 p-3 text-left ${
                activeId === pl.id ? "!border-transparent ring-2 ring-[var(--accent-solid)]" : ""
              }`}
            >
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                {pl.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pl.cover} alt={pl.title} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-accent-br-gradient text-xl text-white">
                    🎧
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{pl.title}</span>
                <span className="block truncate text-xs text-muted">
                  {pl.description || t("music.songCount", { n: pl.songs.length })}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                {pl.songs.length}
              </span>
            </motion.button>
          ))}
        </div>

        {/* 我的收藏：红心过的歌（本地存储），可整单播放 */}
        {favs.length > 0 && (
          <div className="glass-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted">
              <Heart className="h-3.5 w-3.5 text-rose-400" /> {t("music.favorites")}
              <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                {favs.length}
              </span>
            </p>
            <ul className="flex flex-col gap-1">
              {favs.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => player?.play(s, favs)}
                    className={`flex w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/40 dark:hover:bg-white/10 ${
                      player?.current?.id === s.id ? "text-accent" : "text-muted"
                    }`}
                  >
                    <Heart className="h-3 w-3 shrink-0 fill-current text-rose-400" />
                    <span className="truncate">{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recent.length > 0 && (
          <div className="glass-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted">
              <Clock3 className="h-3.5 w-3.5" /> {t("music.recent")}
            </p>
            <ul className="flex flex-col gap-1">
              {recent.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => player?.play(s, recent)}
                    className={`flex w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/40 dark:hover:bg-white/10 ${
                      player?.current?.id === s.id ? "text-accent" : "text-muted"
                    }`}
                  >
                    <Music2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 右：听歌统计 + 歌曲列表 + 歌词 */}
      {active && (
        <div className="flex flex-col gap-5">
          <MusicStatsCard />
          <motion.div
            key={active.id}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass-card overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--glass-border)] px-5 py-4">
              <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
                <ListMusic className="h-4 w-4 text-accent" />
                {active.title}
              </h2>
              <button
                onClick={() => {
                  if (active.songs[0]) {
                    player?.play(toPlayerSong(active.songs[0]), active.songs.map(toPlayerSong));
                  }
                }}
                disabled={!active.songs.length}
                className="glass-button gap-1.5 !py-1.5 text-xs"
              >
                <Play className="h-3.5 w-3.5" /> {t("music.playAll")}
              </button>
            </div>
            <ul className="divide-y divide-[var(--glass-border)]">
              {active.songs.map((s, i) => {
                const isCurrent = player?.current?.id === s.id;
                const faved = isFav(s.id);
                return (
                  <li key={s.id}>
                    {/* 行本身可点播放；红心按钮是行内的独立交互，故用 div role=button 而非嵌套 button */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => player?.play(toPlayerSong(s), active.songs.map(toPlayerSong))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          player?.play(toPlayerSong(s), active.songs.map(toPlayerSong));
                        }
                      }}
                      className={`flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left text-sm transition-colors hover:bg-white/40 dark:hover:bg-white/5 ${
                        isCurrent ? "text-accent" : ""
                      }`}
                    >
                      <span className={`w-5 text-xs tabular-nums ${isCurrent ? "text-accent" : "text-muted"}`}>
                        {isCurrent && player?.playing ? (
                          <span className="inline-flex h-3 items-end gap-0.5">
                            <i className="animate-[equalize_0.9s_ease-in-out_infinite] inline-block w-0.5 bg-current" style={{ height: "60%" }} />
                            <i className="animate-[equalize_0.9s_ease-in-out_0.15s_infinite] inline-block w-0.5 bg-current" style={{ height: "100%" }} />
                            <i className="animate-[equalize_0.9s_ease-in-out_0.3s_infinite] inline-block w-0.5 bg-current" style={{ height: "75%" }} />
                          </span>
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.title}</span>
                        <span className="block truncate text-xs text-muted">{s.artist}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {s.duration ? fmt(s.duration) : "--:--"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(toPlayerSong(s));
                        }}
                        aria-label={faved ? t("music.favRemove") : t("music.favAdd")}
                        title={faved ? t("music.favRemove") : t("music.favAdd")}
                        className={`shrink-0 rounded-full p-1 transition-colors ${
                          faved ? "text-rose-500" : "text-muted/50 hover:text-rose-400"
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${faved ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  </li>
                );
              })}
              {!active.songs.length && (
                <li className="px-5 py-10 text-center text-sm text-muted">{t("music.emptyTitle")}</li>
              )}
            </ul>
          </motion.div>

          <LyricsPanel />
        </div>
      )}
    </div>
  );
}

/** 当前播放歌曲的歌词：解析 LRC 时间轴，随播放进度逐行高亮滚动，点击歌词行跳转进度 */
function LyricsPanel() {
  const player = usePlayer();
  const t = useT();
  const lrc = player?.current?.lrc ?? "";
  const lines = useMemo(() => parseLrc(lrc), [lrc]);
  const progress = player?.progress ?? 0;

  // 当前行 = 最后一条 time <= 进度的行（线性扫，歌词行数量级很小）
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= progress) active = i;
    else break;
  }

  // 跟随滚动：只滚歌词容器自己（scrollIntoView 会连带滚动页面），滚到当前行垂直居中
  const boxRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    const el = activeRef.current;
    if (!box || !el) return;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [active]);

  if (!player?.current) {
    return (
      <div className="glass-card p-8 text-center text-sm text-muted">
        {t("music.emptyHint")}
      </div>
    );
  }
  return (
    <div className="glass-card p-5">
      <p className="mb-2 text-xs font-semibold tracking-widest text-muted">{t("music.nowPlaying")}</p>
      <p className="font-serif text-xl font-bold">{player.current.title}</p>
      <p className="mt-0.5 text-sm text-muted">{player.current.artist}</p>
      {lines.length > 0 ? (
        <div ref={boxRef} className="relative mt-4 flex max-h-60 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pr-1">
          {lines.map((line, i) => (
            <button
              key={`${line.time}-${i}`}
              ref={i === active ? activeRef : undefined}
              onClick={() => player.seek(line.time)}
              title={t("music.progressBar")}
              className={`rounded-lg px-2 py-1 text-left text-sm transition-all duration-300 [overflow-wrap:anywhere] ${
                i === active
                  ? "scale-[1.02] font-semibold text-accent"
                  : "text-muted opacity-55 hover:opacity-100"
              }`}
            >
              {line.text || "♪"}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted opacity-70">{t("music.noLyrics")}</p>
      )}
    </div>
  );
}

/**
 * 听歌统计 + 聆听成就卡：数据来自 /api/player（fetchProgress），
 * 每次播放都会派发 cl-player-update 事件，这里监听实现实时 +1。
 */
function MusicStatsCard() {
  const t = useT();
  const { locale } = useLocale();
  const [prog, setProg] = useState<PlayerProgress | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchProgress().then((p) => {
      if (alive && p) setProg(p);
    });
    const onUpdate = (e: Event) => {
      const d = (e as CustomEvent<PlayerProgress | null>).detail;
      if (d) setProg(d);
    };
    window.addEventListener("cl-player-update", onUpdate);
    return () => {
      alive = false;
      window.removeEventListener("cl-player-update", onUpdate);
    };
  }, []);

  if (!prog) return null;
  const unlocked = new Set(prog.achievements);

  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Headphones className="h-4 w-4 text-accent" />
          {t("music.statsListens")}
          <span className="tabular-nums text-accent">{prog.stats.songsPlayed}</span>
        </span>
        <span className="text-xs text-muted">
          Lv.{prog.level} · {prog.title}
        </span>
      </div>
      <p className="mb-1.5 mt-3 text-[11px] font-semibold tracking-widest text-muted">
        {t("music.statsAchievements")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MUSIC.map((a) => {
          const on = unlocked.has(a.key);
          const pr = achievementProgress(a, prog.stats);
          return (
            <span
              key={a.key}
              title={pick(locale, a.description)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                on
                  ? "bg-accent-soft font-medium text-accent"
                  : "bg-black/5 text-muted dark:bg-white/5"
              }`}
            >
              <span>{a.emoji}</span>
              <span>{pick(locale, a.name)}</span>
              {!on && pr && (
                <span className="tabular-nums opacity-70">
                  {pr.current}/{pr.target}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
