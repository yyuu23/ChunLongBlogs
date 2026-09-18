export interface PostEmbeddingMeta {
  title: string;
  slug: string;
  category?: string | null;
  series?: string | null;
  tags?: string[];
  updatedAt?: Date;
}

/** 按 Markdown 标题与自然段切块，代码围栏内的标题不会被误判。 */
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

/** 中文 2-gram + 英文分词。 */
export function tokenizeQuery(query: string): string[] {
  const terms = new Set<string>();
  for (const word of query.match(/[a-zA-Z0-9_.-]{3,}/g) ?? []) terms.add(word.toLowerCase());
  for (const segment of query.match(/[一-鿿]+/g) ?? []) {
    for (let index = 0; index < segment.length - 1; index++) terms.add(segment.slice(index, index + 2));
  }
  return [...terms].slice(0, 12);
}
