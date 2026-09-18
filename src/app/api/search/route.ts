import { NextResponse } from "next/server";
import { getPublishedPosts } from "@/lib/content/posts";
import { semanticPostSearch } from "@/lib/content/rag/related";

export const dynamic = "force-dynamic";

/** 语义检索的软超时：超时/异常回落纯 LIKE（embedding 未配置时函数直接空数组，零成本） */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/** 站内搜索：GET /api/search?q=关键词 —— SQL LIKE 为主，embedding 配置时语义补足混排 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ items: [] });

  const [{ items }, semantic] = await Promise.all([
    getPublishedPosts({ q, perPage: 8 }),
    withTimeout(semanticPostSearch(q, 5), 1500),
  ]);

  const likeSlugs = new Set(items.map((p) => p.slug));
  const merged: Array<{
    title: string;
    slug: string;
    description: string;
    category: string | null;
    semantic: boolean;
  }> = items.map((p) => ({
    title: p.title,
    slug: p.slug,
    description: p.description,
    category: p.category?.name ?? null,
    semantic: false,
  }));
  for (const hit of semantic ?? []) {
    if (likeSlugs.has(hit.slug) || merged.length >= 10) continue;
    merged.push({
      title: hit.title,
      slug: hit.slug,
      description: hit.description,
      category: hit.category,
      semantic: true as const,
    });
  }
  return NextResponse.json({ items: merged });
}
