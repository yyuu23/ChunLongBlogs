import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { embeddings, moments, posts } from "./db/schema";

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

/** 为单篇（或全部）已发布文章重建向量索引 */
export async function rebuildPostEmbeddings(
  postId?: number,
): Promise<{ error: string } | { ok: true; chunks: number; posts: number }> {
  if (!embeddingConfigured()) {
    return { error: "未配置 EMBEDDING_API_KEY，当前使用关键词检索（不影响问答功能）" };
  }
  const rows = postId
    ? await db.select().from(posts).where(eq(posts.id, postId))
    : await db.select().from(posts);
  const published = rows.filter((p) => p.status === "published");

  // 必须带 refType 条件：embeddings 表被文章和说说共用，同 id 会误删对方；
  // 全量分支同样要先清旧数据，否则每按一次重建按钮向量行就翻一倍。
  await db.delete(embeddings).where(
    postId
      ? and(eq(embeddings.refType, "post"), eq(embeddings.refId, postId))
      : eq(embeddings.refType, "post"),
  );

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
