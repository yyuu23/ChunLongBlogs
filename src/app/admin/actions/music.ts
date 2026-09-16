"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { playlists, songs } from "@/lib/db/schema";
import { guardAdminAction, revalidateSite } from "@/lib/admin/action-utils";
import { fetchNeteaseLyrics, loadNeteasePlaylist, neteaseIdFromUrl } from "@/lib/netease";

export async function savePlaylist(input: { id?: number; title: string; description: string; cover: string }) {
  await guardAdminAction();
  if (!input.title.trim()) return { error: "标题不能为空" };
  const values = { title: input.title.trim(), description: input.description ?? "", cover: input.cover ?? "" };
  if (input.id) await db.update(playlists).set(values).where(eq(playlists.id, input.id));
  else await db.insert(playlists).values(values);
  revalidateSite();
  return { ok: true as const };
}

export async function deletePlaylist(id: number) {
  await guardAdminAction();
  await db.delete(playlists).where(eq(playlists.id, id));
  revalidateSite();
}

export async function saveSong(input: {
  id?: number;
  playlistId: number;
  title: string;
  artist: string;
  cover: string;
  url: string;
  lrc: string;
  duration?: number;
}) {
  await guardAdminAction();
  if (!input.title.trim() || !input.url.trim()) return { error: "歌名与音频地址不能为空" };
  const values = {
    playlistId: input.playlistId,
    title: input.title.trim(),
    artist: input.artist ?? "",
    cover: input.cover ?? "",
    url: input.url.trim(),
    lrc: input.lrc ?? "",
    duration: input.duration ?? 0,
  };
  if (input.id) await db.update(songs).set(values).where(eq(songs.id, input.id));
  else {
    const maxSort = (await db.select({ sort: songs.sort }).from(songs).where(eq(songs.playlistId, input.playlistId))).reduce(
      (max, row) => Math.max(max, row.sort),
      0,
    );
    await db.insert(songs).values({ ...values, sort: maxSort + 1 });
  }
  revalidateSite();
  return { ok: true as const };
}

export async function deleteSong(id: number) {
  await guardAdminAction();
  await db.delete(songs).where(eq(songs.id, id));
  revalidateSite();
}

export async function importNetease(playlistId: string) {
  await guardAdminAction();
  const imported = await loadNeteasePlaylist(playlistId);
  if (!imported.ok) return { error: imported.error };

  const sourceId = `netease:${imported.pid}`;
  const meta = {
    title: imported.title,
    description: `从网易云导入（${imported.rows.length} 首）`,
    cover: imported.cover,
    sourceId,
  };
  const [existing] = await db.select({ id: playlists.id }).from(playlists).where(eq(playlists.sourceId, sourceId)).limit(1);
  let targetId: number;
  let updated = false;
  if (existing) {
    await db.update(playlists).set(meta).where(eq(playlists.id, existing.id));
    await db.delete(songs).where(eq(songs.playlistId, existing.id));
    targetId = existing.id;
    updated = true;
  } else {
    targetId = (await db.insert(playlists).values(meta).returning())[0]!.id;
  }
  await db.insert(songs).values(imported.rows.map((row) => ({ ...row, playlistId: targetId })));
  revalidateSite();
  return {
    ok: true as const,
    count: imported.rows.length,
    updated,
    title: meta.title,
    missing: imported.wantedCount - imported.rows.length,
    lyricsCount: imported.lyricsCount,
  };
}

export async function fetchMissingLyrics(playlistId: number) {
  await guardAdminAction();
  const list = await db.select().from(songs).where(eq(songs.playlistId, playlistId));
  const targets = list.filter((song) => !song.lrc.trim());
  const withIds = targets.flatMap((song) => {
    const neteaseId = neteaseIdFromUrl(song.url);
    return neteaseId === null ? [] : [{ song, neteaseId }];
  });
  if (!withIds.length) return { ok: true as const, fetched: 0, missing: 0 };

  const lyrics = await fetchNeteaseLyrics(withIds.map((item) => item.neteaseId));
  let fetched = 0;
  for (const { song, neteaseId } of withIds) {
    const lyric = lyrics.get(neteaseId);
    if (!lyric) continue;
    await db.update(songs).set({ lrc: lyric }).where(eq(songs.id, song.id));
    fetched += 1;
  }
  revalidateSite();
  return { ok: true as const, fetched, missing: targets.length - fetched };
}
