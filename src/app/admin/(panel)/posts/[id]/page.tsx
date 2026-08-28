import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, postTags, posts, tags } from "@/lib/db/schema";
import { PostEditor } from "@/components/admin/PostEditor";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) notFound();

  const [row] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!row) notFound();

  const [cats, tagRows, relations] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.id)),
    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
    db
      .select({ tagId: postTags.tagId })
      .from(postTags)
      .where(eq(postTags.postId, postId)),
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
        tagNames: tagRows.filter((t) => tagIdSet.has(t.id)).map((t) => t.name),
        status: row.status,
        isPinned: row.isPinned,
      }}
      categories={cats.map((c) => ({ id: c.id, name: c.name }))}
      allTags={tagRows.map((t) => t.name)}
    />
  );
}
