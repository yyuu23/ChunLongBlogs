import type { Metadata, ResolvingMetadata } from "next";
import { asc } from "drizzle-orm";
import { Headphones } from "lucide-react";
import { PageTransition } from "@/components/effects/PageTransition";
import { MusicClient, type MusicPlaylist } from "@/components/music/MusicClient";
import { db } from "@/lib/db";
import { playlists, songs } from "@/lib/db/schema";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  const [{ t }, { alternates }] = await Promise.all([getT(), parent]);
  const description = t("music.subtitle");
  return {
    title: t("music.title"),
    description,
    // 页面级 alternates 会整体替换根布局（浅合并），RSS 自动发现的 types 需显式带回
    alternates: { canonical: "/music", types: alternates?.types ?? undefined },
    openGraph: { title: t("music.title"), description },
  };
}

export default async function MusicPage() {
  const [plRows, songRows, { t }] = await Promise.all([
    db.select().from(playlists).orderBy(asc(playlists.createdAt)),
    db.select().from(songs).orderBy(asc(songs.sort), asc(songs.id)),
    getT(),
  ]);

  const data: MusicPlaylist[] = plRows.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    cover: p.cover,
    songs: songRows
      .filter((s) => s.playlistId === p.id)
      .map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        cover: s.cover,
        url: s.url,
        duration: s.duration,
        lrc: s.lrc,
      })),
  }));

  return (
    <PageTransition>
      <div className="pb-8">
        <header className="mx-auto mb-6 flex w-[min(96%,64rem)] items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-br-gradient text-white">
            <Headphones className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-3xl font-black">{t("music.title")}</h1>
            <p className="text-sm text-muted">{t("music.subtitle")}</p>
          </div>
        </header>
        <MusicClient playlists={data} />
      </div>
    </PageTransition>
  );
}
