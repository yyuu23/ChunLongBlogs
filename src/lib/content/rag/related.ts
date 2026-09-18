import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, embeddings, posts } from "@/lib/db/schema";
import { cosine, embed, embeddingConfigured } from "@/lib/content/rag/embedding";

export interface RelatedPostItem {
  id: number;
  slug: string;
  title: string;
  description: string;
  cover: string;
  category: { name: string; slug: string; color: string } | null;
  publishedAt: Date | null;
}

export async function relatedPosts(postId: number, count = 3): Promise<RelatedPostItem[]> {
  const [self] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!self) return [];
  const postRows = await db.select().from(posts).where(eq(posts.status, "published"));
  const others = postRows.filter((post) => post.id !== postId);
  if (!others.length) return [];

  let ranked: number[] = [];
  try {
    if (embeddingConfigured()) {
      const rows = await db.select().from(embeddings).where(eq(embeddings.refType, "post"));
      const byPost = new Map<number, number[][]>();
      for (const row of rows) {
        try {
          const vector = JSON.parse(row.vector) as number[];
          const list = byPost.get(row.refId) ?? [];
          list.push(vector);
          byPost.set(row.refId, list);
        } catch {}
      }
      const own = byPost.get(postId);
      if (own?.length) {
        const dimension = own[0]!.length;
        const center = new Array<number>(dimension).fill(0);
        for (const vector of own) {
          for (let index = 0; index < dimension; index++) center[index]! += vector[index]!;
        }
        for (let index = 0; index < dimension; index++) center[index]! /= own.length;
        const scored = others
          .map((post) => {
            const vectors = byPost.get(post.id);
            if (!vectors?.length) return null;
            return { id: post.id, score: Math.max(...vectors.map((vector) => cosine(center, vector))) };
          })
          .filter((item): item is { id: number; score: number } => item !== null)
          .sort((a, b) => b.score - a.score)
          .slice(0, count);
        if (scored.length) ranked = scored.map((item) => item.id);
      }
    }
  } catch {
    // 向量数据异常时回落到分类和发布时间。
  }

  if (ranked.length < count) {
    const picked = new Set(ranked);
    const sameCategory = self.categoryId
      ? others
          .filter((post) => post.categoryId === self.categoryId && !picked.has(post.id))
          .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
      : [];
    for (const post of sameCategory) {
      if (ranked.length >= count) break;
      ranked.push(post.id);
      picked.add(post.id);
    }
    const latest = [...others].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
    for (const post of latest) {
      if (ranked.length >= count) break;
      if (!picked.has(post.id)) {
        ranked.push(post.id);
        picked.add(post.id);
      }
    }
  }

  const categoryRows = ranked.length
    ? await db.select().from(categories).where(inArray(categories.id, [...new Set(postRows.filter((post) => ranked.includes(post.id) && post.categoryId != null).map((post) => post.categoryId!))]))
    : [];
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));
  return ranked
    .map((id) => postRows.find((post) => post.id === id))
    .filter((post): post is (typeof postRows)[number] => !!post)
    .map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      description: post.description,
      cover: post.cover,
      category: post.categoryId != null ? categoryMap.get(post.categoryId) ?? null : null,
      publishedAt: post.publishedAt,
    }));
}

export interface SemanticHit {
  postId: number;
  slug: string;
  title: string;
  description: string;
  category: string | null;
  score: number;
}

export async function semanticPostSearch(query: string, topK = 5, minScore = 0.3): Promise<SemanticHit[]> {
  try {
    if (!embeddingConfigured() || !query.trim()) return [];
    const [queryVector] = await embed([query.slice(0, 200)]);
    if (!queryVector) return [];
    const [rows, postRows, categoryRows] = await Promise.all([
      db.select().from(embeddings).where(eq(embeddings.refType, "post")),
      db.select().from(posts).where(eq(posts.status, "published")),
      db.select().from(categories),
    ]);
    const published = new Map(postRows.map((post) => [post.id, post]));
    const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]));
    const best = new Map<number, number>();
    for (const row of rows) {
      const post = published.get(row.refId);
      if (!post) continue;
      try {
        const score = cosine(queryVector, JSON.parse(row.vector) as number[]);
        const previous = best.get(row.refId);
        if (previous === undefined || score > previous) best.set(row.refId, score);
      } catch {}
    }
    return [...best.entries()]
      .filter(([, score]) => score >= minScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([id, score]) => {
        const post = published.get(id)!;
        return {
          postId: id,
          slug: post.slug,
          title: post.title,
          description: post.description,
          category: post.categoryId != null ? categoryNames.get(post.categoryId) ?? null : null,
          score,
        };
      });
  } catch {
    return [];
  }
}
