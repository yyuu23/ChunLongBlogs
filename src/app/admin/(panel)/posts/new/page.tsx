import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, tags } from "@/lib/db/schema";
import { PostEditor } from "@/components/admin/PostEditor";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const [cats, tagRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.id)),
    db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)),
  ]);

  return (
    <PostEditor
      initial={{
        title: "",
        slug: "",
        description: "",
        content: "",
        cover: "",
        categoryId: cats[0]?.id ?? null,
        tagNames: [],
        status: "draft",
        isPinned: false,
      }}
      categories={cats}
      allTags={tagRows.map((t) => t.name)}
    />
  );
}
