"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Play, Music2, Clock3, ListMusic } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/components/music/PlayerProvider";

export interface MusicPlaylist {
  id: number;
  title: string;
  description: string;
  cover: string;
  songs: { id: number; title: string; artist: string; cover: string; url: string; duration: number }[];
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function MusicClient({ playlists }: { playlists: MusicPlaylist[] }) {
  const player = usePlayer();
  const [activeId, setActiveId] = useState<number | null>(playlists[0]?.id ?? null);
  const [recent, setRecent] = useState<PlayerSong[]>([]);

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

  const active = playlists.find((p) => p.id === activeId) ?? null;
  const toPlayerSong = (s: MusicPlaylist["songs"][number]): PlayerSong => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    cover: s.cover,
    url: s.url,
  });

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
                  {pl.description || `${pl.songs.length} 首`}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                {pl.songs.length}
              </span>
            </motion.button>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="glass-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted">
              <Clock3 className="h-3.5 w-3.5" /> 最近播放
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

      {/* 右：歌曲列表 + 歌词 */}
      {active && (
        <div className="flex flex-col gap-5">
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
                <Play className="h-3.5 w-3.5" /> 播放全部
              </button>
            </div>
            <ul className="divide-y divide-[var(--glass-border)]">
              {active.songs.map((s, i) => {
                const isCurrent = player?.current?.id === s.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => player?.play(toPlayerSong(s), active.songs.map(toPlayerSong))}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors hover:bg-white/40 dark:hover:bg-white/5 ${
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
                    </button>
                  </li>
                );
              })}
              {!active.songs.length && (
                <li className="px-5 py-10 text-center text-sm text-muted">歌单还是空的</li>
              )}
            </ul>
          </motion.div>

          <LyricsPanel />
        </div>
      )}
    </div>
  );
}

/** 当前播放歌曲的歌词（无歌词时显示提示） */
function LyricsPanel() {
  const player = usePlayer();
  const lines = useMemo(() => {
    // lrc 数据暂未接入逐行时间轴，这里先做静态展示占位
    return null;
  }, []);

  if (!player?.current) {
    return (
      <div className="glass-card p-8 text-center text-sm text-muted">
        点击左上角「播放全部」或任意歌曲开始聆听 · 切换页面音乐不会中断 🎵
      </div>
    );
  }
  return (
    <div className="glass-card p-5">
      <p className="mb-2 text-xs font-semibold tracking-widest text-muted">正在播放</p>
      <p className="font-serif text-xl font-bold">{player.current.title}</p>
      <p className="mt-0.5 text-sm text-muted">{player.current.artist}</p>
      {lines ?? (
        <p className="mt-4 text-xs text-muted opacity-70">
          {lines === null ? "这首歌没有配置歌词（.lrc 可在后台粘贴）" : ""}
        </p>
      )}
    </div>
  );
}
