import { asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, posts, tags } from "@/lib/db/schema";
import { CategoriesTagsManager } from "@/components/admin/CategoriesTagsManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const [cats, tagRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        // 同 lib/posts.ts：sql`` 里插值列会丢表前缀，手写限定名防裸 id 绑到内层 posts.id
        count: sql<number>`(SELECT count(*) FROM posts p WHERE p.category_id = categories.id)`,
      })
      .from(categories)
      .orderBy(asc(categories.id)),
    db
      .select({
        id: tags.id,
        name: tags.name,
        count: sql<number>`(SELECT count(*) FROM post_tags pt WHERE pt.tag_id = tags.id)`,
      })
      .from(tags)
      .orderBy(asc(tags.name)),
  ]);

  // 让 sql<number> 返回值为 number（better-sqlite3 返回 number，保险转换）
  return (
    <div>
      <h1 className="mx-auto mb-6 max-w-5xl text-xl font-bold">分类与标签</h1>
      <CategoriesTagsManager
        categories={cats.map((c) => ({ ...c, count: Number(c.count) }))}
        tags={tagRows.map((t) => ({ ...t, count: Number(t.count) }))}
      />
    </div>
  );
}
