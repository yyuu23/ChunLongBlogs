import Link from "next/link";
import { Headphones } from "lucide-react";
import { LazyImage } from "@/components/effects/Typewriter";
import { relativeTime } from "@/lib/shared/utils";
import type { Locale } from "@/lib/i18n/config";
import type { T } from "@/lib/i18n/server";

interface ListeningSong {
  title: string;
  artist: string;
  cover: string;
  lastPlayedAt: number;
}

/**
 * "最近在听"卡：全站最近一次播放的快照（首页 SSR 时直查 songs.lastPlayedAt
 * top-1，48h 内有播放才渲染），点击整卡进音乐馆。纯展示 server 组件。
 */
export function ListeningCard({ song, t, locale }: { song: ListeningSong; t: T; locale: Locale }) {
  // 网易云外链可能是 http://，强制 https 防混合内容拦截
  const cover = song.cover.replace(/^http:\/\//, "https://");
  return (
    <Link href="/music" className="glass-card glass-hover group flex items-center gap-3 p-4">
      {cover ? (
        <LazyImage
          src={cover}
          alt={song.title}
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-xl object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
          <Headphones className="h-5 w-5 text-accent" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium tracking-widest text-muted">
          <Headphones className="h-3.5 w-3.5 text-accent" />
          {t("home.listeningTitle")}
        </p>
        <p className="truncate text-sm font-semibold">{song.title}</p>
        <p className="truncate text-xs text-muted">
          {song.artist ? `${song.artist} · ` : ""}
          {relativeTime(song.lastPlayedAt, locale)}
        </p>
      </div>
    </Link>
  );
}
