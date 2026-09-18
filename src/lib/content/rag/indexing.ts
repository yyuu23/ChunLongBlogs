import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, embeddingIndexState, embeddings, moments, posts, series } from "@/lib/db/schema";
import { getPostTagNames } from "@/lib/content/posts";
import { chunkPostForEmbedding } from "@/lib/content/rag/chunking";
import { embed, embeddingConfigured } from "@/lib/content/rag/embedding";

function momentText(moment: { content: string; mood: string | null; location: string | null; createdAt: Date }) {
  const date = new Date(moment.createdAt);
  return `${moment.mood ? moment.mood + " " : ""}${moment.content}${moment.location ? `（${moment.location}）` : ""}（发布于 ${date.getFullYear()} 年 ${date.getMonth() + 1} 月）`;
}

export type RebuildSource = "post" | "moment";

export async function deleteEmbeddings(refType: RebuildSource, refId: number) {
  await db.delete(embeddings).where(and(eq(embeddings.refType, refType), eq(embeddings.refId, refId)));
}

async function writeIndexState(source: RebuildSource, error = "") {
  const now = new Date();
  await db
    .insert(embeddingIndexState)
    .values({ source, lastRunAt: now, lastSuccessAt: error ? null : now, lastError: error })
    .onConflictDoUpdate({
      target: embeddingIndexState.source,
      set: {
        lastRunAt: now,
        ...(error ? {} : { lastSuccessAt: now }),
        lastError: error,
      },
    });
}

export interface EmbeddingIndexStatus {
  configured: boolean;
  publishedPosts: number;
  indexedPosts: number;
  chunks: number;
  lastIndexedAt: Date | null;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string;
}

export async function getEmbeddingIndexStatus(): Promise<EmbeddingIndexStatus> {
  const [publishedRows, indexRows, lastRows, stateRows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(posts).where(eq(posts.status, "published")),
    db
      .select({ chunks: sql<number>`count(*)`, posts: sql<number>`count(distinct ${embeddings.refId})` })
      .from(embeddings)
      .where(eq(embeddings.refType, "post")),
    db
      .select({ createdAt: embeddings.createdAt })
      .from(embeddings)
      .where(eq(embeddings.refType, "post"))
      .orderBy(desc(embeddings.createdAt))
      .limit(1),
    db.select().from(embeddingIndexState).where(eq(embeddingIndexState.source, "post")).limit(1),
  ]);
  return {
    configured: embeddingConfigured(),
    publishedPosts: Number(publishedRows[0]?.n ?? 0),
    indexedPosts: Number(indexRows[0]?.posts ?? 0),
    chunks: Number(indexRows[0]?.chunks ?? 0),
    lastIndexedAt: lastRows[0]?.createdAt ?? null,
    lastRunAt: stateRows[0]?.lastRunAt ?? null,
    lastSuccessAt: stateRows[0]?.lastSuccessAt ?? null,
    lastError: stateRows[0]?.lastError ?? "",
  };
}

export async function rebuildPostEmbeddings(
  postId?: number,
): Promise<{ error: string } | { ok: true; chunks: number; posts: number; failures: number }> {
  if (!embeddingConfigured()) {
    const error = "未配置 EMBEDDING_API_KEY，当前使用关键词检索（不影响问答功能）";
    await writeIndexState("post", error);
    return { error };
  }
  const rows = postId
    ? await db.select().from(posts).where(eq(posts.id, postId))
    : await db.select().from(posts);
  const published = rows.filter((post) => post.status === "published");
  if (postId && !published.length) {
    await deleteEmbeddings("post", postId);
    await writeIndexState("post");
    return { ok: true, chunks: 0, posts: 0, failures: 0 };
  }
  if (!postId) {
    const publishedIds = published.map((post) => post.id);
    const oldRows = await db.select({ refId: embeddings.refId }).from(embeddings).where(eq(embeddings.refType, "post"));
    const stale = [...new Set(oldRows.map((row) => row.refId).filter((id) => !publishedIds.includes(id)))];
    if (stale.length) await db.delete(embeddings).where(and(eq(embeddings.refType, "post"), inArray(embeddings.refId, stale)));
  }

  const [categoryRows, seriesRows, tagMap] = await Promise.all([
    db.select().from(categories),
    db.select().from(series),
    getPostTagNames(published.map((post) => post.id)),
  ]);
  const categoryMap = new Map(categoryRows.map((item) => [item.id, item.name]));
  const seriesMap = new Map(seriesRows.map((item) => [item.id, item.title]));

  let count = 0;
  let failures = 0;
  let lastError = "";
  for (const post of published) {
    const chunks = chunkPostForEmbedding(
      {
        title: post.title,
        slug: post.slug,
        category: post.categoryId ? categoryMap.get(post.categoryId) : null,
        series: post.seriesId ? seriesMap.get(post.seriesId) : null,
        tags: tagMap.get(post.id) ?? [],
        updatedAt: post.updatedAt,
      },
      post.content,
    );
    if (!chunks.length) continue;
    try {
      const vectors = await embed(chunks);
      db.$client.transaction(() => {
        db.delete(embeddings).where(and(eq(embeddings.refType, "post"), eq(embeddings.refId, post.id))).run();
        db.insert(embeddings).values(chunks.map((chunk, index) => ({ refType: "post", refId: post.id, chunk, vector: JSON.stringify(vectors[index]) }))).run();
      })();
      count += chunks.length;
    } catch (error) {
      failures += 1;
      lastError = error instanceof Error ? error.message : "向量生成失败";
    }
  }
  await writeIndexState("post", failures ? `${failures} 篇失败：${lastError}` : "");
  if (failures === published.length && published.length > 0) return { error: lastError || "向量生成失败" };
  return { ok: true, chunks: count, posts: published.length - failures, failures };
}

export async function rebuildMomentEmbeddings(
  momentId?: number,
): Promise<{ error: string } | { ok: true; chunks: number; moments: number }> {
  if (!embeddingConfigured()) {
    return { error: "未配置 EMBEDDING_API_KEY，当前使用关键词检索（不影响问答功能）" };
  }
  const rows = momentId
    ? await db.select().from(moments).where(eq(moments.id, momentId))
    : await db.select().from(moments);

  await db.delete(embeddings).where(
    momentId
      ? and(eq(embeddings.refType, "moment"), eq(embeddings.refId, momentId))
      : eq(embeddings.refType, "moment"),
  );
  if (!rows.length) return { ok: true, chunks: 0, moments: 0 };

  try {
    const texts = rows.map(momentText);
    const vectors = await embed(texts);
    await db.insert(embeddings).values(
      texts.map((chunk, index) => ({
        refType: "moment" as const,
        refId: rows[index]!.id,
        chunk,
        vector: JSON.stringify(vectors[index]),
      })),
    );
    return { ok: true, chunks: texts.length, moments: rows.length };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "说说向量生成失败" };
  }
}
