"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { trackEvent } from "@/lib/track";
import { Play, Pause, SkipBack, SkipForward, X, Volume2, VolumeX } from "lucide-react";

export interface PlayerSong {
  id: number;
  title: string;
  artist: string;
  cover: string;
  url: string;
}

interface PlayerCtx {
  current: PlayerSong | null;
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  play: (song: PlayerSong, queue?: PlayerSong[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  close: () => void;
}

const Ctx = createContext<PlayerCtx | null>(null);
export const usePlayer = () => useContext(Ctx);

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<PlayerSong | null>(null);
  const [queue, setQueue] = useState<PlayerSong[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  // 单例 audio 元素：跨页面唯一实例
  if (typeof window !== "undefined" && !audioRef.current) {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = 0.8;
    audioRef.current = audio;
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onErr = () => {
      setFailed(true);
      setPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onErr);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onErr);
    };
  }, []);

  const recordRecent = (song: PlayerSong) => {
    try {
      const raw = localStorage.getItem("cl-recent-songs");
      const list: PlayerSong[] = raw ? JSON.parse(raw) : [];
      const next = [song, ...list.filter((s) => s.id !== song.id)].slice(0, 12);
      localStorage.setItem("cl-recent-songs", JSON.stringify(next));
    } catch {}
  };

  const startPlay = useCallback((song: PlayerSong) => {
    const audio = audioRef.current;
    if (!audio) return;
    setFailed(false);
    setCurrent(song);
    setProgress(0);
    setDuration(0);
    audio.src = song.url;
    void audio.play().catch(() => setFailed(true));
    recordRecent(song);
    trackEvent("play_music", { title: song.title });
  }, []);

  const play = useCallback(
    (song: PlayerSong, q?: PlayerSong[]) => {
      if (q) setQueue(q);
      startPlay(song);
    },
    [startPlay],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!current || queue.length < 2) return;
      const idx = queue.findIndex((s) => s.id === current.id);
      const nextSong = queue[(idx + dir + queue.length) % queue.length];
      if (nextSong) startPlay(nextSong);
    },
    [current, queue, startPlay],
  );

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  // 播完自动下一首
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => next();
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [next]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  }, [current]);

  const seek = useCallback((t: number) => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(t)) {
      audio.currentTime = t;
      setProgress(t);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    setVolumeState(v);
    if (audio) audio.volume = v;
  }, []);

  const setMutedAll = useCallback((m: boolean) => {
    const audio = audioRef.current;
    setMuted(m);
    if (audio) audio.muted = m;
  }, []);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    setCurrent(null);
    setQueue([]);
    setPlaying(false);
    setProgress(0);
  }, []);

  const value = useMemo(
    () => ({
      current,
      playing,
      progress,
      duration,
      volume,
      muted,
      play,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setMuted: setMutedAll,
      close,
    }),
    [current, playing, progress, duration, volume, muted, play, toggle, next, prev, seek, setVolume, setMutedAll, close],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <MiniPlayer failed={failed} />
    </Ctx.Provider>
  );
}

/** 底部迷你播放条：封面旋转 + 进度 + 控制按钮（与页面路由无关，音乐不断） */
function MiniPlayer({ failed }: { failed: boolean }) {
  const p = usePlayer();
  if (!p?.current) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="glass-card fixed bottom-20 left-4 right-4 z-40 flex items-center gap-3 !rounded-3xl px-4 py-2.5 md:bottom-6 md:left-auto md:right-6 md:w-[min(30rem,40vw)]"
      >
        {/* 旋转封面 */}
        <div className="relative h-11 w-11 shrink-0">
          {p.current.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.current.cover}
              alt={p.current.title}
              className={`h-full w-full rounded-full object-cover ring-2 ring-white/40 dark:ring-white/10 ${
                p.playing ? "animate-[spin_8s_linear_infinite]" : ""
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-accent-gradient text-lg">
              🎵
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{p.current.title}</p>
          <p className="truncate text-[11px] text-muted">
            {failed ? "⚠️ 音频不可用（可能为版权限制）" : p.current.artist || "未知歌手"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="w-8 text-right text-[10px] tabular-nums text-muted">{fmt(p.progress)}</span>
            <input
              type="range"
              min={0}
              max={p.duration || 0}
              step={0.1}
              value={p.progress}
              onChange={(e) => p.seek(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/40 accent-[var(--accent-solid)] dark:bg-white/15"
              aria-label="播放进度"
            />
            <span className="w-8 text-[10px] tabular-nums text-muted">{fmt(p.duration)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={p.prev} aria-label="上一首" className="rounded-full p-2 text-muted hover:text-[var(--accent-text)]">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={p.toggle}
            aria-label={p.playing ? "暂停" : "播放"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-gradient text-white shadow"
          >
            {p.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={p.next} aria-label="下一首" className="rounded-full p-2 text-muted hover:text-[var(--accent-text)]">
            <SkipForward className="h-4 w-4" />
          </button>
          <button
            onClick={() => p.setMuted(!p.muted)}
            aria-label="静音"
            className="hidden rounded-full p-2 text-muted hover:text-[var(--accent-text)] sm:block"
          >
            {p.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button onClick={p.close} aria-label="关闭播放器" className="rounded-full p-2 text-muted hover:text-rose-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
