import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { embeddings, moments, posts } from "@/lib/db/schema";
import { tokenizeQuery } from "@/lib/content/rag/chunking";
import { cosine, embed, embeddingConfigured } from "@/lib/content/rag/embedding";

export type RetrievedChunk =
  | { kind: "post"; postId: number; slug: string; title: string; chunk: string; score: number }
  | { kind: "moment"; momentId: number; date: string; chunk: string; score: number };

function momentText(moment: { content: string; mood: string | null; location: string | null; createdAt: Date }) {
  const date = new Date(moment.createdAt);
  return `${moment.mood ? moment.mood + " " : ""}${moment.content}${moment.location ? `（${moment.location}）` : ""}（发布于 ${date.getFullYear()} 年 ${date.getMonth() + 1} 月）`;
}

function monthOf(date: Date) {
  return `${new Date(date).getFullYear()}-${String(new Date(date).getMonth() + 1).padStart(2, "0")}`;
}

async function keywordSearch(query: string, topK = 3): Promise<RetrievedChunk[]> {
  const terms = tokenizeQuery(query);
  if (!terms.length) return [];

  const countHits = (haystack: string, term: string) => {
    let index = -1;
    let hits = 0;
    while ((index = haystack.indexOf(term, index + 1)) !== -1 && hits < 20) hits++;
    return hits;
  };

  const postRows = await db.select().from(posts).where(eq(posts.status, "published"));
  const postHits: RetrievedChunk[] = postRows
    .map((post) => {
      const title = post.title.toLowerCase();
      const haystack = title + "\n" + post.content.toLowerCase();
      let score = 0;
      if (terms.some((term) => title.includes(term))) score += 5;
      for (const term of terms) {
        if (term.length < 2) continue;
        score += countHits(haystack, term);
      }
      return { post, score };
    })
    .filter((item) => item.score > 3)
    .map(({ post, score }) => ({
      kind: "post" as const,
      postId: post.id,
      slug: post.slug,
      title: post.title,
      chunk: `《${post.title}》\n${post.content.slice(0, 900)}`,
      score,
    }));

  const momentRows = await db.select().from(moments);
  const momentHits: RetrievedChunk[] = momentRows
    .map((moment) => {
      const text = momentText(moment);
      const haystack = text.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (term.length < 2) continue;
        score += countHits(haystack, term);
      }
      return { moment, text, score };
    })
    .filter((item) => item.score > 2)
    .map(({ moment, text, score }) => ({
      kind: "moment" as const,
      momentId: moment.id,
      date: monthOf(moment.createdAt),
      chunk: text,
      score,
    }));

  return [...postHits, ...momentHits].sort((a, b) => b.score - a.score).slice(0, topK);
}

async function vectorSearch(query: string, topK = 3): Promise<RetrievedChunk[]> {
  const [queryVector] = await embed([query]);
  const rows = await db
    .select()
    .from(embeddings)
    .where(inArray(embeddings.refType, ["post", "moment"]));
  if (!rows.length) return [];

  const postRows = await db.select().from(posts).where(eq(posts.status, "published"));
  const published = new Map(postRows.map((post) => [post.id, post]));
  const momentRows = await db.select().from(moments);
  const momentMap = new Map(momentRows.map((moment) => [moment.id, moment]));

  return rows
    .map((row): RetrievedChunk | null => {
      try {
        const vector = JSON.parse(row.vector) as number[];
        if (row.refType === "post") {
          const post = published.get(row.refId);
          if (!post) return null;
          return { kind: "post", postId: post.id, slug: post.slug, title: post.title, chunk: row.chunk, score: cosine(queryVector, vector) };
        }
        const moment = momentMap.get(row.refId);
        if (!moment) return null;
        return { kind: "moment", momentId: moment.id, date: monthOf(moment.createdAt), chunk: row.chunk, score: cosine(queryVector, vector) };
      } catch {
        return null;
      }
    })
    .filter((item): item is RetrievedChunk => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function retrieveContext(query: string, topK = 3) {
  if (embeddingConfigured()) {
    try {
      const [vectors, keywords] = await Promise.all([vectorSearch(query, topK * 2), keywordSearch(query, topK * 2)]);
      if (vectors.length) {
        const merged = new Map<string, { hit: RetrievedChunk; score: number }>();
        const keyOf = (hit: RetrievedChunk) => hit.kind === "post" ? `post:${hit.postId}` : `moment:${hit.momentId}`;
        vectors.forEach((hit, index) => merged.set(keyOf(hit), { hit, score: 1 / (60 + index) }));
        keywords.forEach((hit, index) => {
          const key = keyOf(hit);
          const current = merged.get(key);
          merged.set(key, { hit: current?.hit ?? hit, score: (current?.score ?? 0) + 1 / (60 + index) });
        });
        return {
          mode: "hybrid" as const,
          hits: [...merged.values()].sort((a, b) => b.score - a.score).slice(0, topK).map(({ hit }) => hit),
        };
      }
    } catch {
      // embedding 不可用时继续关键词降级。
    }
  }
  return { mode: "keyword" as const, hits: await keywordSearch(query, topK) };
}
