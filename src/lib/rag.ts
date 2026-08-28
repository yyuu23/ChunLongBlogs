import { eq } from "drizzle-orm";
import { db } from "./db";
import { embeddings, posts } from "./db/schema";

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

/** 按 ~600 字切块（标题附加在每个块前，提升检索质量） */
function chunkPost(title: string, content: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const para of content.split(/\n{2,}/)) {
    if ((current + para).length > 600 && current) {
      chunks.push(`《${title}》\n${current}`);
      current = "";
    }
    current += `${para}\n\n`;
  }
  if (current.trim()) chunks.push(`《${title}》\n${current.trim()}`);
  return chunks.slice(0, 12);
}

/** 为单篇（或全部）已发布文章重建向量索引 */
export async function rebuildPostEmbeddings(postId?: number) {
  if (!embeddingConfigured()) {
    return { error: "未配置 EMBEDDING_API_KEY，当前使用关键词检索（不影响问答功能）" };
  }
  const rows = postId
    ? await db.select().from(posts).where(eq(posts.id, postId))
    : await db.select().from(posts);
  const published = rows.filter((p) => p.status === "published");

  if (postId) await db.delete(embeddings).where(eq(embeddings.refId, postId));

  let count = 0;
  for (const post of published) {
    const chunks = chunkPost(post.title, post.content);
    if (!chunks.length) continue;
    try {
      const vectors = await embed(chunks);
      await db.insert(embeddings).values(
        chunks.map((chunk, i) => ({
          refType: "post",
          refId: post.id,
          chunk,
          vector: JSON.stringify(vectors[i]),
        })),
      );
      count += chunks.length;
    } catch {
      // 单篇失败不阻塞整体
    }
  }
  return { ok: true as const, chunks: count, posts: published.length };
}

/** ===== 检索 ===== */

export interface RetrievedChunk {
  postId: number;
  slug: string;
  title: string;
  chunk: string;
  score: number;
}

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
  for (const seg of query.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (let i = 0; i < seg.length - 1; i++) terms.add(seg.slice(i, i + 2));
  }
  return [...terms].slice(0, 12);
}

/** 关键词检索：2-gram 命中计数排序（零依赖兜底方案） */
async function keywordSearch(query: string, topK = 3): Promise<RetrievedChunk[]> {
  const terms = tokenizeQuery(query);
  if (!terms.length) return [];

  const rows = await db.select().from(posts).where(eq(posts.status, "published"));
  const scored = rows
    .map((p) => {
      let score = 0;
      const titleHit = terms.some((t) => p.title.includes(t));
      if (titleHit) score += 5;
      const hay = p.title + "\n" + p.content;
      for (const t of terms) {
        if (t.length < 2) continue;
        let idx = -1;
        let hits = 0;
        while ((idx = hay.indexOf(t, idx + 1)) !== -1 && hits < 20) {
          score += 1;
          hits++;
        }
      }
      return { p, score };
    })
    .filter((x) => x.score > 3) // 2-gram 噪音多，阈值提高到 3
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(({ p, score }) => ({
    postId: p.id,
    slug: p.slug,
    title: p.title,
    chunk: `《${p.title}》\n${p.content.slice(0, 900)}`,
    score,
  }));
}

/** 向量检索（配置 embedding 后自动启用），失败自动回落关键词 */
async function vectorSearch(query: string, topK = 3): Promise<RetrievedChunk[]> {
  const [qv] = await embed([query]);
  const rows = await db.select().from(embeddings).where(eq(embeddings.refType, "post"));
  if (!rows.length) return [];

  const postsRows = await db.select().from(posts).where(eq(posts.status, "published"));
  const published = new Map(postsRows.map((p) => [p.id, p]));

  return rows
    .map((r) => {
      const post = published.get(r.refId);
      if (!post) return null;
      try {
        return {
          postId: post.id,
          slug: post.slug,
          title: post.title,
          chunk: r.chunk,
          score: cosine(qv, JSON.parse(r.vector) as number[]),
        };
      } catch {
        return null;
      }
    })
    .filter((x): x is RetrievedChunk => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** 对外入口：优先向量，未配置/失败回落关键词 */
export async function retrieveContext(query: string, topK = 3) {
  if (embeddingConfigured()) {
    try {
      const hits = await vectorSearch(query, topK);
      if (hits.length) return { mode: "vector" as const, hits };
    } catch {
      // 回落
    }
  }
  return { mode: "keyword" as const, hits: await keywordSearch(query, topK) };
}
