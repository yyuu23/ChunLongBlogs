"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { postTags, posts, tags } from "@/lib/db/schema";
import { guardAdminAction, revalidateSite } from "@/lib/admin/action-utils";
import type { PostInput } from "@/lib/admin/post-types";
import { importMarkdownPost, importPostsFromContentDir, type ImportResult } from "@/lib/post-import";
import { countWords, excerpt, readingTimeMinutes, slugify } from "@/lib/utils";

export async function savePost(input: PostInput) {
  await guardAdminAction();
  const title = input.title.trim();
  if (!title) return { error: "标题不能为空" };
  if (input.status === "scheduled" && !input.publishedAt) return { error: "请选择定时发布时间" };
  const content = input.content ?? "";

  let slug = (input.slug ?? "").trim() || slugify(title);
  const [conflict] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
  if (conflict && conflict.id !== input.id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const payload = {
    title,
    slug,
    description: (input.description ?? "").trim() || excerpt(content, 100),
    content,
    cover: input.cover ?? "",
    categoryId: input.categoryId ?? null,
    seriesId: input.seriesId ?? null,
    seriesOrder: Math.max(0, Math.floor(input.seriesOrder ?? 0)),
    difficulty: input.difficulty ?? null,
    status: input.status,
    isPinned: input.isPinned ?? false,
    wordCount: countWords(content),
    readingTime: readingTimeMinutes(content),
    updatedAt: new Date(),
    publishedAt:
      input.status === "scheduled"
        ? input.publishedAt
          ? new Date(input.publishedAt)
          : new Date()
        : input.status === "published"
          ? new Date()
          : null,
  };

  let postId: number;
  if (input.id) {
    await db.update(posts).set(payload).where(eq(posts.id, input.id));
    postId = input.id;
  } else {
    const [row] = await db.insert(posts).values({ ...payload, createdAt: new Date() }).returning();
    postId = row.id;
  }

  await db.delete(postTags).where(eq(postTags.postId, postId));
  for (const name of input.tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const tagSlug = slugify(trimmed);
    let tagRow = (await db.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1))[0];
    if (!tagRow) tagRow = (await db.insert(tags).values({ name: trimmed, slug: tagSlug }).returning())[0];
    await db.insert(postTags).values({ postId, tagId: tagRow.id }).onConflictDoNothing();
  }

  revalidateSite();
  if (input.status === "published") {
    try {
      const { rebuildPostEmbeddings } = await import("@/lib/rag");
      void rebuildPostEmbeddings(postId).catch(() => {});
    } catch {}
  }
  return { ok: true as const, id: postId, slug };
}

export async function deletePost(id: number) {
  await guardAdminAction();
  await db.delete(posts).where(eq(posts.id, id));
  try {
    const { deleteEmbeddings } = await import("@/lib/rag");
    await deleteEmbeddings("post", id);
  } catch {}
  revalidateSite();
}

export async function importMarkdownFiles(files: { name: string; text: string }[]): Promise<ImportResult[]> {
  await guardAdminAction();
  const results: ImportResult[] = [];
  for (const file of files.slice(0, 50)) results.push(await importMarkdownPost(file.text, file.name));
  if (results.some((result) => result.outcome !== "error")) revalidateSite();
  return results;
}

export async function importMarkdownFromContentDir(): Promise<ImportResult[]> {
  await guardAdminAction();
  const results = await importPostsFromContentDir();
  if (results.some((result) => result.outcome !== "error")) revalidateSite();
  return results;
}

export async function togglePostPin(id: number) {
  await guardAdminAction();
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) return;
  await db.update(posts).set({ isPinned: !row.isPinned }).where(eq(posts.id, id));
  revalidateSite();
}

export async function setPostStatus(id: number, status: "draft" | "published" | "scheduled") {
  await guardAdminAction();
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) return;
  await db
    .update(posts)
    .set({
      status,
      publishedAt:
        status === "published" ? new Date() : status === "scheduled" ? row.publishedAt ?? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));
  if (status === "published") {
    try {
      const { rebuildPostEmbeddings } = await import("@/lib/rag");
      void rebuildPostEmbeddings(id).catch(() => {});
    } catch {}
  } else {
    try {
      const { deleteEmbeddings } = await import("@/lib/rag");
      await deleteEmbeddings("post", id);
    } catch {}
  }
  revalidateSite();
}

export async function deletePostsByIds(ids: number[]) {
  await guardAdminAction();
  if (!ids.length) return;
  await db.delete(postTags).where(inArray(postTags.postId, ids));
  await db.delete(posts).where(inArray(posts.id, ids));
  try {
    const { deleteEmbeddings } = await import("@/lib/rag");
    await Promise.all(ids.map((id) => deleteEmbeddings("post", id)));
  } catch {}
  revalidateSite();
}
