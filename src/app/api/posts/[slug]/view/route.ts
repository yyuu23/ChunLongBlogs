import { NextResponse } from "next/server";
import { eq, sql, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** 阅读量自增：POST /api/posts/[slug]/view */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const updated = await db
    .update(posts)
    .set({ views: sql`${posts.views} + 1` })
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")))
    .returning({ views: posts.views });

  if (!updated.length) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ views: updated[0].views });
}
