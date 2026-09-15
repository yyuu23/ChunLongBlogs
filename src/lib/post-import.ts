/**
 * Markdown 文章批量导入（纯逻辑，无 "use server"、不碰请求上下文）：
 * 解析 front-matter 并按 slug upsert 入库。admin 的两个导入入口
 * （actions.ts）与本地脚本 scripts/import-posts.ts 共用这一份。
 *
 * 字段约定与 scripts/seed.ts 一致：title/slug/description/cover/
 * category(slug)/tags([])/date/pinned/draft。分类与标签不存在则自动创建。
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import matter from "gray-matter";
import { db } from "@/lib/db";
import { categories, postTags, posts, tags } from "@/lib/db/schema";
import { countWords, excerpt, readingTimeMinutes, slugify } from "@/lib/utils";

export interface ImportResult {
  file: string;
  slug: string;
  title: string;
  /** created=新建导入；updated=同 slug 已存在，正文/标签已更新；error=解析或入库失败 */
  outcome: "created" | "updated" | "error";
  note?: string;
}

/**
 * 解析一篇 front-matter markdown 并入库。幂等键 = slug：已存在则更新
 * （publishedAt 尊重 front-matter 的 date，重复导入结果稳定）。
 */
export async function importMarkdownPost(raw: string, file: string): Promise<ImportResult> {
  try {
    const { data, content } = matter(raw);
    const title = String(data.title ?? "").trim();
    if (!title) return { file, slug: "", title: "", outcome: "error", note: "缺少 title" };
    const slug = String(data.slug ?? "").trim() || slugify(title);
    const isDraft = Boolean(data.draft);
    const date = data.date ? new Date(data.date) : new Date();

    let categoryId: number | null = null;
    const catSlug = String(data.category ?? "").trim();
    if (catSlug) {
      let cat = (await db.select().from(categories).where(eq(categories.slug, catSlug)).limit(1))[0];
      if (!cat) cat = (await db.insert(categories).values({ name: catSlug, slug: catSlug }).returning())[0]!;
      categoryId = cat.id;
    }

    const existing = (await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1))[0];
    const payload = {
      title,
      slug,
      description: String(data.description ?? "").trim() || excerpt(content, 100),
      content,
      cover: String(data.cover ?? ""),
      categoryId,
      status: isDraft ? ("draft" as const) : ("published" as const),
      isPinned: Boolean(data.pinned),
      wordCount: countWords(content),
      readingTime: readingTimeMinutes(content),
      updatedAt: new Date(),
      publishedAt: isDraft ? null : date,
    };

    let postId: number;
    if (existing) {
      await db.update(posts).set(payload).where(eq(posts.id, existing.id));
      postId = existing.id;
    } else {
      const [row] = await db
        .insert(posts)
        .values({ ...payload, createdAt: date })
        .returning();
      postId = row.id;
    }

    // 标签关联（同 savePost：先清后插，标签按 slug upsert）
    await db.delete(postTags).where(eq(postTags.postId, postId));
    const tagNames: string[] = Array.isArray(data.tags) ? data.tags.map(String) : [];
    for (const name of tagNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      const tslug = slugify(trimmed);
      let tagRow = (await db.select().from(tags).where(eq(tags.slug, tslug)).limit(1))[0];
      if (!tagRow) tagRow = (await db.insert(tags).values({ name: trimmed, slug: tslug }).returning())[0];
      if (tagRow) await db.insert(postTags).values({ postId, tagId: tagRow.id }).onConflictDoNothing();
    }

    if (!isDraft) {
      try {
        const { rebuildPostEmbeddings } = await import("@/lib/rag");
        void rebuildPostEmbeddings(postId).catch(() => {});
      } catch {}
    }
    return { file, slug, title, outcome: existing ? "updated" : "created" };
  } catch (e) {
    return { file, slug: "", title: "", outcome: "error", note: e instanceof Error ? e.message : "解析失败" };
  }
}

/** 读取 content/posts/ 下全部 .md 逐篇导入（目录不存在返回空数组） */
export async function importPostsFromContentDir(): Promise<ImportResult[]> {
  const dir = path.join(process.cwd(), "content/posts");
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
  const results: ImportResult[] = [];
  for (const name of names) {
    results.push(await importMarkdownPost(fs.readFileSync(path.join(dir, name), "utf8"), name));
  }
  return results;
}
