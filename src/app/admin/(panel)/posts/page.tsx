import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, posts } from "@/lib/db/schema";
import { PostsTable, type AdminPostRow } from "@/components/admin/PostsTable";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      isPinned: posts.isPinned,
      views: posts.views,
      wordCount: posts.wordCount,
      updatedAt: posts.updatedAt,
      categoryName: categories.name,
    })
    .from(posts)
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .orderBy(desc(posts.isPinned), desc(posts.updatedAt));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-xl font-bold">文章管理</h1>
      <PostsTable rows={rows as AdminPostRow[]} />
    </div>
  );
}
