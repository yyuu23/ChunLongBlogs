import { asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { playlists, songs } from "@/lib/db/schema";
import { MusicManager } from "@/components/admin/MusicManager";

export const dynamic = "force-dynamic";

export default async function AdminMusicPage() {
  const [plRows, songRows] = await Promise.all([
    db
      .select({
        id: playlists.id,
        title: playlists.title,
        description: playlists.description,
        cover: playlists.cover,
        songCount: sql<number>`(SELECT count(*) FROM songs s WHERE s.playlist_id = ${playlists.id})`,
      })
      .from(playlists)
      .orderBy(asc(playlists.createdAt)),
    db.select().from(songs).orderBy(asc(songs.sort), asc(songs.id)),
  ]);

  const songsByPlaylist: Record<number, Array<{
    id: number;
    title: string;
    artist: string;
    cover: string;
    url: string;
    lrc: string;
  }>> = {};
  for (const s of songRows) {
    (songsByPlaylist[s.playlistId] ??= []).push({
      id: s.id,
      title: s.title,
      artist: s.artist,
      cover: s.cover,
      url: s.url,
      lrc: s.lrc,
    });
  }

  return (
    <div>
      <h1 className="mx-auto mb-6 max-w-4xl text-xl font-bold">音乐馆管理</h1>
      <MusicManager
        playlists={plRows.map((p) => ({ ...p, songCount: Number(p.songCount) }))}
        songs={songsByPlaylist}
      />
    </div>
  );
}
