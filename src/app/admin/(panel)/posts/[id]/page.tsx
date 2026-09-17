import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, postTags, posts, series, tags } from "@/lib/db/schema";
import { cogviewConfigured } from "@/lib/ai-image";
import { PostEditor } from "@/components/admin/PostEditor";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) notFound();

  const [row] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!row) notFound();

  const [cats, tagRows, relations, seriesRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.id)),
    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
    db
      .select({ tagId: postTags.tagId })
      .from(postTags)
      .where(eq(postTags.postId, postId)),
    db.select({ id: series.id, title: series.title }).from(series).orderBy(asc(series.sort), asc(series.id)),
  ]);
  const tagIdSet = new Set(relations.map((r) => r.tagId));

  return (
    <PostEditor
      initial={{
        id: row.id,
        title: row.title,
        slug: row.slug,
        description: row.description,
        content: row.content,
        cover: row.cover,
        categoryId: row.categoryId,
        seriesId: row.seriesId,
        seriesOrder: row.seriesOrder,
        difficulty: row.difficulty,
        tagNames: tagRows.filter((t) => tagIdSet.has(t.id)).map((t) => t.name),
        status: row.status,
        isPinned: row.isPinned,
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      }}
      categories={cats.map((c) => ({ id: c.id, name: c.name }))}
      seriesOptions={seriesRows}
      allTags={tagRows.map((t) => t.name)}
      aiCoverEnabled={cogviewConfigured()}
    />
  );
}
