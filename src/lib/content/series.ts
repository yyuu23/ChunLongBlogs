import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts, series } from "@/lib/db/schema";
import type { PublicSeriesDetail, PublicSeriesSummary } from "@/lib/content/types";

export async function getPublishedSeries(): Promise<PublicSeriesSummary[]> {
  const [seriesRows, postRows] = await Promise.all([
    db.select().from(series).where(eq(series.status, "published")).orderBy(asc(series.sort), asc(series.id)),
    db
      .select({ seriesId: posts.seriesId, readingTime: posts.readingTime })
      .from(posts)
      .where(eq(posts.status, "published")),
  ]);
  return seriesRows.map((item) => {
    const mine = postRows.filter((post) => post.seriesId === item.id);
    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      description: item.description,
      cover: item.cover,
      postCount: mine.length,
      totalMinutes: mine.reduce((sum, post) => sum + post.readingTime, 0),
    };
  });
}

export async function getSeriesBySlug(slug: string): Promise<PublicSeriesDetail | null> {
  const [item] = await db
    .select()
    .from(series)
    .where(and(eq(series.slug, slug), eq(series.status, "published")))
    .limit(1);
  if (!item) return null;
  const articleRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      description: posts.description,
      cover: posts.cover,
      order: posts.seriesOrder,
      difficulty: posts.difficulty,
      readingTime: posts.readingTime,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(and(eq(posts.seriesId, item.id), eq(posts.status, "published")))
    .orderBy(asc(posts.seriesOrder), asc(posts.publishedAt), asc(posts.id));
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    description: item.description,
    cover: item.cover,
    postCount: articleRows.length,
    totalMinutes: articleRows.reduce((sum, post) => sum + post.readingTime, 0),
    posts: articleRows,
  };
}

export async function getSeriesForPost(postId: number) {
  const [post] = await db
    .select({ seriesId: posts.seriesId, order: posts.seriesOrder })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!post?.seriesId) return null;
  const [item] = await db
    .select()
    .from(series)
    .where(and(eq(series.id, post.seriesId), eq(series.status, "published")))
    .limit(1);
  if (!item) return null;
  const entries = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      order: posts.seriesOrder,
      readingTime: posts.readingTime,
      difficulty: posts.difficulty,
    })
    .from(posts)
    .where(and(eq(posts.seriesId, item.id), eq(posts.status, "published")))
    .orderBy(asc(posts.seriesOrder), asc(posts.id));
  const index = entries.findIndex((entry) => entry.id === postId);
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    description: item.description,
    entries,
    current: index >= 0 ? index + 1 : 0,
    total: entries.length,
    prev: index > 0 ? entries[index - 1] : null,
    next: index >= 0 && index < entries.length - 1 ? entries[index + 1] : null,
  };
}
