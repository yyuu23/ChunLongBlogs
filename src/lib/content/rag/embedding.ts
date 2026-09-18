export function embeddingConfigured() {
  return Boolean(process.env.EMBEDDING_API_KEY);
}

export async function embed(texts: string[]): Promise<number[][]> {
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
  const list = data.data?.map((item) => item.embedding);
  if (!list || list.length !== texts.length) throw new Error("embedding 返回数量不符");
  return list;
}

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
