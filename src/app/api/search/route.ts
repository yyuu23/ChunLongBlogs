import { NextResponse } from "next/server";
import { getPublishedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

/** 站内搜索：GET /api/search?q=关键词 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ items: [] });

  const { items } = await getPublishedPosts({ q, perPage: 8 });
  return NextResponse.json({
    items: items.map((p) => ({
      title: p.title,
      slug: p.slug,
      description: p.description,
      category: p.category?.name ?? null,
    })),
  });
}
