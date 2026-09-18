import { asc, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { albums, moments, photos, playlists, songs } from "@/lib/db/schema";
import { getCategoriesWithCount, getSiteStats, getTagsWithCount } from "@/lib/content/posts";
import { cleanLimit, cleanStr, dayOf } from "@/lib/chat/tools/args";

export async function listMoments(args: Record<string, unknown>) {
  const limit = cleanLimit(args.limit, 10, 30);
  const [rows, totalRows] = await Promise.all([
    db.select().from(moments).orderBy(desc(moments.createdAt)).limit(limit),
    db.select({ n: sql<number>`count(*)` }).from(moments),
  ]);
  return {
    total: totalRows[0]?.n ?? 0,
    returned: rows.length,
    moments: rows.map((moment) => {
      let images: string[] = [];
      try {
        images = JSON.parse(moment.images) as string[];
      } catch {}
      return {
        date: dayOf(moment.createdAt),
        mood: moment.mood || undefined,
        location: moment.location || undefined,
        imageCount: images.length || undefined,
        firstImage: images[0] || undefined,
        content: moment.content.length > 400 ? `${moment.content.slice(0, 400)}…` : moment.content,
      };
    }),
  };
}

export async function listAlbums() {
  const [albumRows, photoRows, totalRows] = await Promise.all([
    db.select().from(albums).orderBy(asc(albums.createdAt)),
    db
      .select({ albumId: photos.albumId, caption: photos.caption })
      .from(photos)
      .orderBy(asc(photos.sort), asc(photos.id)),
    db.select({ n: sql<number>`count(*)` }).from(photos),
  ]);
  return {
    totalPhotos: totalRows[0]?.n ?? 0,
    albums: albumRows.map((album) => {
      const ownPhotos = photoRows.filter((photo) => photo.albumId === album.id);
      return {
        title: album.title,
        description: album.description || null,
        cover: album.cover || null,
        createdAt: dayOf(album.createdAt),
        photoCount: ownPhotos.length,
        photoCaptions: ownPhotos.filter((photo) => photo.caption).slice(0, 5).map((photo) => photo.caption),
      };
    }),
  };
}

export async function listMusic(args: Record<string, unknown>) {
  const perList = cleanLimit(args.songsPerList, 8, 20);
  const title = cleanStr(args.title, 64);
  const [lists, songRows] = await Promise.all([
    db.select().from(playlists).orderBy(asc(playlists.createdAt)),
    db
      .select({
        playlistId: songs.playlistId,
        title: songs.title,
        artist: songs.artist,
        duration: songs.duration,
      })
      .from(songs)
      .orderBy(asc(songs.sort), asc(songs.id)),
  ]);
  const formatDuration = (seconds: number) =>
    seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : null;
  const matchedLists = title ? lists.filter((list) => list.title.includes(title)) : lists;
  return {
    totalPlaylists: lists.length,
    playlists: matchedLists.map((list) => {
      const ownSongs = songRows.filter((song) => song.playlistId === list.id);
      return {
        title: list.title,
        description: list.description || null,
        songCount: ownSongs.length,
        songs: ownSongs.slice(0, perList).map((song) => ({
          title: song.title,
          artist: song.artist || null,
          duration: formatDuration(song.duration),
        })),
      };
    }),
  };
}

export async function siteStats() {
  const [stats, categoryRows, tagRows, momentCount, albumCount, photoCount] = await Promise.all([
    getSiteStats(),
    getCategoriesWithCount(),
    getTagsWithCount(),
    db.select({ n: sql<number>`count(*)` }).from(moments),
    db.select({ n: sql<number>`count(*)` }).from(albums),
    db.select({ n: sql<number>`count(*)` }).from(photos),
  ]);
  return {
    publishedPosts: stats.posts,
    totalWords: stats.words,
    totalPostViews: stats.views,
    moments: momentCount[0]?.n ?? 0,
    albums: albumCount[0]?.n ?? 0,
    photos: photoCount[0]?.n ?? 0,
    categories: categoryRows.filter((category) => category.count > 0).map((category) => ({ name: category.name, slug: category.slug, count: category.count })),
    tags: tagRows.filter((tag) => tag.count > 0).map((tag) => ({ name: tag.name, slug: tag.slug, count: tag.count })),
  };
}
