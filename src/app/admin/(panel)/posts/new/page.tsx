import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, series, tags } from "@/lib/db/schema";
import { cogviewConfigured } from "@/lib/ai-image";
import { PostEditor } from "@/components/admin/PostEditor";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const [cats, tagRows, seriesRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.id)),
    db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)),
    db.select({ id: series.id, title: series.title }).from(series).orderBy(asc(series.sort), asc(series.id)),
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
        seriesId: null,
        seriesOrder: 0,
        difficulty: null,
        tagNames: [],
        status: "draft",
        isPinned: false,
      }}
      categories={cats}
      seriesOptions={seriesRows}
      allTags={tagRows.map((t) => t.name)}
      aiCoverEnabled={cogviewConfigured()}
    />
  );
}
