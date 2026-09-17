import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { categories, embeddingIndexState, embeddings, moments, posts, series } from "./db/schema";
import { getPostTagNames } from "@/lib/content-hub";

/** ===== Embedding（可选配置，未配置时 RAG 自动走关键词检索） ===== */

export function embeddingConfigured() {
  return Boolean(process.env.EMBEDDING_API_KEY);
}

async function embed(texts: string[]): Promise<number[][]> {
  const base = (
    process.env.EMBEDDING_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4"
  ).replace(/\/$/, "");
  const model = process.env.EMBEDDING_MODEL ?? "embedding-3";
  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({ model, input: texts }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`embedding 接口返回 ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  const list = data.data?.map((d) => d.embedding);
  if (!list || list.length !== texts.length) throw new Error("embedding 返回数量不符");
  return list;
}

interface PostEmbeddingMeta {
  title: string;
  slug: string;
  category?: string | null;
  series?: string | null;
  tags?: string[];
  updatedAt?: Date;
}

/**
 * 按 Markdown 标题与自然段切块。每块都附带可追溯元数据，既提升召回，也让模型
 * 得到片段时知道它来自哪篇文章/系列；不在代码围栏中按标题误切。
 */
export function chunkPostForEmbedding(meta: PostEmbeddingMeta, content: string): string[] {
  const chunks: string[] = [];
  let heading = "";
  let current: string[] = [];
  let size = 0;
  let inFence = false;
  const prefix = [
    `文章：《${meta.title}》`,
    `链接：/posts/${meta.slug}`,
    meta.series ? `系列：${meta.series}` : "",
    meta.category ? `分类：${meta.category}` : "",
    meta.tags?.length ? `标签：${meta.tags.join("、")}` : "",
    meta.updatedAt ? `更新：${meta.updatedAt.toISOString().slice(0, 10)}` : "",
  ].filter(Boolean).join("｜");
  const flush = () => {
    const body = current.join("\n\n").trim();
    if (body) chunks.push(`${prefix}${heading ? `\n章节：${heading}` : ""}\n${body}`);
    current = [];
    size = 0;
  };

  for (const block of content.split(/\n{2,}/)) {
    const fenceCount = (block.match(/```/g) ?? []).length;
    const titleLine = !inFence ? block.match(/^#{1,4}\s+(.+)$/)?.[1]?.trim() : undefined;
    if (titleLine) {
      flush();
      heading = titleLine.slice(0, 120);
    }
    if (size + block.length > 800 && current.length) flush();
    current.push(block);
    size += block.length;
    if (fenceCount % 2 === 1) inFence = !inFence;
  }
  flush();
  return chunks.slice(0, 20);
}

/** 说说可检索文本：极短不切块，mood/location/年月拼入提升召回与时间语境 */
function momentText(m: { content: string; mood: string | null; location: string | null; createdAt: Date }) {
  const d = new Date(m.createdAt);
  return `${m.mood ? m.mood + " " : ""}${m.content}${m.location ? `（${m.location}）` : ""}（发布于 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月）`;
}

function monthOf(date: Date) {
  return `${new Date(date).getFullYear()}-${String(new Date(date).getMonth() + 1).padStart(2, "0")}`;
}

/** 删除某内容的向量行（内容删除时清孤儿向量用） */
export async function deleteEmbeddings(refType: RebuildSource, refId: number) {
  await db.delete(embeddings).where(and(eq(embeddings.refType, refType), eq(embeddings.refId, refId)));
}

/** 向量重建结果：未配置 key 或失败时走 error 分支 */
export type RebuildSource = "post" | "moment";

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

/** 为单篇（或全部）已发布文章重建向量索引 */
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
  const published = rows.filter((p) => p.status === "published");
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
        db.insert(embeddings).values(chunks.map((chunk, i) => ({ refType: "post", refId: post.id, chunk, vector: JSON.stringify(vectors[i]) }))).run();
      })();
      count += chunks.length;
    } catch (error) {
      failures += 1;
      lastError = error instanceof Error ? error.message : "向量生成失败";
    }
  }
  await writeIndexState("post", failures ? `${failures} 篇失败：${lastError}` : "");
  if (failures === published.length && published.length > 0) return { error: lastError || "向量生成失败" };
  return { ok: true as const, chunks: count, posts: published.length - failures, failures };
}

/** 为单条（或全部）说说重建向量索引：一条一个文档，批量一次 embed */
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
  if (!rows.length) return { ok: true as const, chunks: 0, moments: 0 };

  try {
    const texts = rows.map(momentText);
    const vectors = await embed(texts);
    await db.insert(embeddings).values(
      texts.map((chunk, i) => ({
        refType: "moment" as const,
        refId: rows[i]!.id,
        chunk,
        vector: JSON.stringify(vectors[i]),
      })),
    );
    return { ok: true as const, chunks: texts.length, moments: rows.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "说说向量生成失败" };
  }
}

/** ===== 检索 ===== */

export type RetrievedChunk =
  | { kind: "post"; postId: number; slug: string; title: string; chunk: string; score: number }
  | { kind: "moment"; momentId: number; date: string; chunk: string; score: number };

function cosine(a: number[], b: number[]) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** 中文 2-gram + 英文分词（中文无空格，整句匹配会零命中） */
export function tokenizeQuery(query: string): string[] {
  const terms = new Set<string>();
  for (const w of query.match(/[a-zA-Z0-9_.-]{3,}/g) ?? []) terms.add(w.toLowerCase());
  for (const seg of query.match(/[一-鿿]+/g) ?? []) {
    for (let i = 0; i < seg.length - 1; i++) terms.add(seg.slice(i, i + 2));
  }
  return [...terms].slice(0, 12);
}

/** 关键词检索：2-gram 命中计数排序（零依赖兜底方案）。文章与说说混排 */
async function keywordSearch(query: string, topK = 3): Promise<RetrievedChunk[]> {
  const terms = tokenizeQuery(query);
  if (!terms.length) return [];

  const countHits = (hay: string, t: string) => {
    let idx = -1;
    let hits = 0;
    while ((idx = hay.indexOf(t, idx + 1)) !== -1 && hits < 20) hits++;
    return hits;
  };

  const postRows = await db.select().from(posts).where(eq(posts.status, "published"));
  const postHits: RetrievedChunk[] = postRows
    .map((p) => {
      // 英文统一小写再比对（"CSS" 要能被 "css" 命中），terms 已在分词时小写
      const title = p.title.toLowerCase();
      const hay = title + "\n" + p.content.toLowerCase();
      let score = 0;
      if (terms.some((t) => title.includes(t))) score += 5;
      for (const t of terms) {
        if (t.length < 2) continue;
        score += countHits(hay, t);
      }
      return { p, score };
    })
    .filter((x) => x.score > 3) // 2-gram 噪音多，阈值提高到 3
    .map(({ p, score }) => ({
      kind: "post" as const,
      postId: p.id,
      slug: p.slug,
      title: p.title,
      chunk: `《${p.title}》\n${p.content.slice(0, 900)}`,
      score,
    }));

  // 说说极短（几十字），一条 2-gram 命中含的信息量大，阈值放宽到 >2
  const momentRows = await db.select().from(moments);
  const momentHits: RetrievedChunk[] = momentRows
    .map((m) => {
      const text = momentText(m);
      const hay = text.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (t.length < 2) continue;
        score += countHits(hay, t);
      }
      return { m, text, score };
    })
    .filter((x) => x.score > 2)
    .map(({ m, text, score }) => ({
      kind: "moment" as const,
      momentId: m.id,
      date: monthOf(m.createdAt),
      chunk: text,
      score,
    }));

  return [...postHits, ...momentHits].sort((a, b) => b.score - a.score).slice(0, topK);
}

/** 向量检索（配置 embedding 后自动启用），文章与说说混排，失败自动回落关键词 */
async function vectorSearch(query: string, topK = 3): Promise<RetrievedChunk[]> {
  const [qv] = await embed([query]);
  const rows = await db
    .select()
    .from(embeddings)
    .where(inArray(embeddings.refType, ["post", "moment"]));
  if (!rows.length) return [];

  const postsRows = await db.select().from(posts).where(eq(posts.status, "published"));
  const published = new Map(postsRows.map((p) => [p.id, p]));
  const momentRows = await db.select().from(moments);
  const momentMap = new Map(momentRows.map((m) => [m.id, m]));

  return rows
    .map((r): RetrievedChunk | null => {
      try {
        const vector = JSON.parse(r.vector) as number[];
        if (r.refType === "post") {
          const post = published.get(r.refId);
          if (!post) return null;
          return { kind: "post", postId: post.id, slug: post.slug, title: post.title, chunk: r.chunk, score: cosine(qv, vector) };
        }
        const m = momentMap.get(r.refId);
        if (!m) return null;
        return { kind: "moment", momentId: m.id, date: monthOf(m.createdAt), chunk: r.chunk, score: cosine(qv, vector) };
      } catch {
        return null;
      }
    })
    .filter((x): x is RetrievedChunk => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** 对外入口：向量与关键词并行，用倒数排名融合；任一不可用时自然降级。 */
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
      // 回落
    }
  }
  return { mode: "keyword" as const, hits: await keywordSearch(query, topK) };
}

/** ===== 相关文章推荐（embedding 相似度，文章页"相关阅读"用） ===== */

export interface RelatedPostItem {
  id: number;
  slug: string;
  title: string;
  description: string;
  cover: string;
  category: { name: string; slug: string; color: string } | null;
  publishedAt: Date | null;
}

/**
 * 相关阅读：本文各 chunk 向量平均 → 与其他已发布文章的 chunks 算 cosine →
 * 按文章取最高相似度 → top n。未配置 embedding / 无向量 / 异常时回落
 * 同分类最新 n 篇（不足补全站最新）。文章规模下全表载入无压力。
 */
export async function relatedPosts(postId: number, n = 3): Promise<RelatedPostItem[]> {
  const [self] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!self) return [];
  const postsRows = await db.select().from(posts).where(eq(posts.status, "published"));
  const others = postsRows.filter((p) => p.id !== postId);
  if (!others.length) return [];

  let ranked: number[] = [];
  try {
    if (embeddingConfigured()) {
      const rows = await db.select().from(embeddings).where(eq(embeddings.refType, "post"));
      const byPost = new Map<number, number[][]>();
      for (const r of rows) {
        try {
          const vec = JSON.parse(r.vector) as number[];
          const list = byPost.get(r.refId) ?? [];
          list.push(vec);
          byPost.set(r.refId, list);
        } catch {}
      }
      const own = byPost.get(postId);
      if (own?.length) {
        // 本文向量平均（chunks 中心）
        const dim = own[0]!.length;
        const center = new Array<number>(dim).fill(0);
        for (const v of own) for (let i = 0; i < dim; i++) center[i]! += v[i]!;
        for (let i = 0; i < dim; i++) center[i]! /= own.length;
        // 其他文章取其 chunks 的最高相似度
        const scored = others
          .map((p) => {
            const vecs = byPost.get(p.id);
            if (!vecs?.length) return null;
            const best = Math.max(...vecs.map((v) => cosine(center, v)));
            return { id: p.id, score: best };
          })
          .filter((x): x is { id: number; score: number } => x !== null)
          .sort((a, b) => b.score - a.score)
          .slice(0, n);
        if (scored.length) ranked = scored.map((s) => s.id);
      }
    }
  } catch {
    // 回落
  }

  // 回落（向量不足 n 篇时补同分类最新，再不足补全站最新）
  if (ranked.length < n) {
    const picked = new Set(ranked);
    const byCat = self.categoryId
      ? others
          .filter((p) => p.categoryId === self.categoryId && !picked.has(p.id))
          .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
      : [];
    for (const p of byCat) {
      if (ranked.length >= n) break;
      ranked.push(p.id);
      picked.add(p.id);
    }
    const latest = [...others].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
    for (const p of latest) {
      if (ranked.length >= n) break;
      if (!picked.has(p.id)) {
        ranked.push(p.id);
        picked.add(p.id);
      }
    }
  }

  const catRows = ranked.length
    ? await db.select().from(categories).where(inArray(categories.id, [...new Set(postsRows.filter((p) => ranked.includes(p.id) && p.categoryId != null).map((p) => p.categoryId!))]))
    : [];
  const catMap = new Map(catRows.map((c) => [c.id, c]));
  return ranked
    .map((id) => postsRows.find((p) => p.id === id))
    .filter((p): p is (typeof postsRows)[number] => !!p)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      cover: p.cover,
      category: p.categoryId != null ? catMap.get(p.categoryId) ?? null : null,
      publishedAt: p.publishedAt,
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

/** 仅文章的语义检索（搜索面板补足用）：未配置 embedding / 无向量 / 任何异常 → 空数组（调用方回落纯 LIKE） */
export async function semanticPostSearch(query: string, topK = 5, minScore = 0.3): Promise<SemanticHit[]> {
  try {
    if (!embeddingConfigured() || !query.trim()) return [];
    const [qv] = await embed([query.slice(0, 200)]);
    if (!qv) return [];
    const [rows, postsRows, catRows] = await Promise.all([
      db.select().from(embeddings).where(eq(embeddings.refType, "post")),
      db.select().from(posts).where(eq(posts.status, "published")),
      db.select().from(categories),
    ]);
    const published = new Map(postsRows.map((p) => [p.id, p]));
    const catName = new Map(catRows.map((c) => [c.id, c.name]));
    const best = new Map<number, number>();
    for (const r of rows) {
      const post = published.get(r.refId);
      if (!post) continue;
      try {
        const score = cosine(qv, JSON.parse(r.vector) as number[]);
        const prev = best.get(r.refId);
        if (prev === undefined || score > prev) best.set(r.refId, score);
      } catch {}
    }
    return [...best.entries()]
      .filter(([, score]) => score >= minScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([id, score]) => {
        const p = published.get(id)!;
        return {
          postId: id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          category: p.categoryId != null ? catName.get(p.categoryId) ?? null : null,
          score,
        };
      });
  } catch {
    return [];
  }
}
