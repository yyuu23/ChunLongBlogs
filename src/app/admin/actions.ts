"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  adminUsers,
  albums,
  categories,
  friendLinks,
  moments,
  photos,
  postTags,
  posts,
  tags,
} from "@/lib/db/schema";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { saveSiteConfig, type SiteConfig } from "@/lib/site";
import { countWords, readingTimeMinutes, slugify } from "@/lib/utils";

async function guard() {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  return session;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/* ============ 登录 / 退出 ============ */

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return "请输入账号和密码";

  const rows = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return "账号或密码错误";
  }
  await createSession(username);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

/* ============ 文章 ============ */

export interface PostInput {
  id?: number;
  title: string;
  slug?: string;
  description?: string;
  content: string;
  cover?: string;
  categoryId?: number | null;
  tagNames: string[];
  status: "draft" | "published";
  isPinned?: boolean;
  publishedAt?: string | null;
}

export async function savePost(input: PostInput) {
  await guard();
  const title = input.title.trim();
  if (!title) return { error: "标题不能为空" };
  const content = input.content ?? "";

  let slug = (input.slug ?? "").trim() || slugify(title);
  // slug 唯一性：冲突时追加随机后缀
  const conflict = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.slug, slug))
    .limit(1);
  if (conflict[0] && conflict[0].id !== input.id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const payload = {
    title,
    slug,
    description: (input.description ?? "").trim() || content.slice(0, 100),
    content,
    cover: input.cover ?? "",
    categoryId: input.categoryId ?? null,
    status: input.status,
    isPinned: input.isPinned ?? false,
    wordCount: countWords(content),
    readingTime: readingTimeMinutes(content),
    updatedAt: new Date(),
    publishedAt:
      input.status === "published"
        ? input.publishedAt
          ? new Date(input.publishedAt)
          : new Date()
        : null,
  };

  let postId: number;
  if (input.id) {
    await db.update(posts).set(payload).where(eq(posts.id, input.id));
    postId = input.id;
  } else {
    const [row] = await db
      .insert(posts)
      .values({ ...payload, createdAt: new Date() })
      .returning();
    postId = row.id;
  }

  // 标签关联
  await db.delete(postTags).where(eq(postTags.postId, postId));
  for (const name of input.tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const tslug = slugify(trimmed);
    let tagRow = (await db.select().from(tags).where(eq(tags.slug, tslug)).limit(1))[0];
    if (!tagRow) {
      tagRow = (await db.insert(tags).values({ name: trimmed, slug: tslug }).returning())[0];
    }
    await db.insert(postTags).values({ postId, tagId: tagRow.id }).onConflictDoNothing();
  }

  revalidateAll();
  return { ok: true as const, id: postId, slug };
}

export async function deletePost(id: number) {
  await guard();
  await db.delete(posts).where(eq(posts.id, id));
  revalidateAll();
}

export async function togglePostPin(id: number) {
  await guard();
  const row = (await db.select().from(posts).where(eq(posts.id, id)).limit(1))[0];
  if (!row) return;
  await db.update(posts).set({ isPinned: !row.isPinned }).where(eq(posts.id, id));
  revalidateAll();
}

export async function setPostStatus(id: number, status: "draft" | "published") {
  await guard();
  await db
    .update(posts)
    .set({
      status,
      publishedAt: status === "published" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));
  revalidateAll();
}

/* ============ 分类 / 标签 ============ */

export async function saveCategory(input: { id?: number; name: string; color?: string }) {
  await guard();
  const name = input.name.trim();
  if (!name) return { error: "名称不能为空" };
  const values = { name, slug: slugify(name), color: input.color || "#6366f1" };
  if (input.id) {
    await db.update(categories).set(values).where(eq(categories.id, input.id));
  } else {
    await db.insert(categories).values(values).onConflictDoNothing();
  }
  revalidateAll();
  return { ok: true as const };
}

export async function deleteCategory(id: number) {
  await guard();
  await db.delete(categories).where(eq(categories.id, id));
  revalidateAll();
}

export async function createTag(name: string) {
  await guard();
  const trimmed = name.trim();
  if (!trimmed) return { error: "名称不能为空" };
  await db.insert(tags).values({ name: trimmed, slug: slugify(trimmed) }).onConflictDoNothing();
  revalidateAll();
  return { ok: true as const };
}

export async function deleteTag(id: number) {
  await guard();
  await db.delete(tags).where(eq(tags.id, id));
  revalidateAll();
}

/* ============ 说说 ============ */

export async function saveMoment(input: {
  id?: number;
  content: string;
  images: string[];
  mood?: string;
  location?: string;
}) {
  await guard();
  if (!input.content.trim()) return { error: "内容不能为空" };
  const values = {
    content: input.content.trim(),
    images: JSON.stringify(input.images),
    mood: input.mood ?? "",
    location: input.location ?? "",
  };
  if (input.id) {
    await db.update(moments).set(values).where(eq(moments.id, input.id));
  } else {
    await db.insert(moments).values(values);
  }
  revalidateAll();
  return { ok: true as const };
}

export async function deleteMoment(id: number) {
  await guard();
  await db.delete(moments).where(eq(moments.id, id));
  revalidateAll();
}

/* ============ 友链 ============ */

export async function saveFriend(input: {
  id?: number;
  name: string;
  url: string;
  avatar: string;
  description: string;
  sort: number;
}) {
  await guard();
  if (!input.name.trim() || !input.url.trim()) return { error: "名称与链接不能为空" };
  const values = {
    name: input.name.trim(),
    url: input.url.trim(),
    avatar: input.avatar ?? "",
    description: input.description ?? "",
    sort: input.sort || 0,
  };
  if (input.id) {
    await db.update(friendLinks).set(values).where(eq(friendLinks.id, input.id));
  } else {
    await db.insert(friendLinks).values(values);
  }
  revalidateAll();
  return { ok: true as const };
}

export async function deleteFriend(id: number) {
  await guard();
  await db.delete(friendLinks).where(eq(friendLinks.id, id));
  revalidateAll();
}

/* ============ 相册 ============ */

export async function saveAlbum(input: { id?: number; title: string; description: string; cover: string }) {
  await guard();
  if (!input.title.trim()) return { error: "标题不能为空" };
  const values = {
    title: input.title.trim(),
    description: input.description ?? "",
    cover: input.cover ?? "",
  };
  if (input.id) {
    await db.update(albums).set(values).where(eq(albums.id, input.id));
  } else {
    await db.insert(albums).values(values);
  }
  revalidateAll();
  return { ok: true as const };
}

export async function deleteAlbum(id: number) {
  await guard();
  await db.delete(albums).where(eq(albums.id, id));
  revalidateAll();
}

export async function addPhotos(albumId: number, urls: string[], caption = "") {
  await guard();
  if (!urls.length) return { error: "没有图片" };
  const maxSort = (
    await db.select({ sort: photos.sort }).from(photos).where(eq(photos.albumId, albumId))
  ).reduce((m, r) => Math.max(m, r.sort), 0);
  await db.insert(photos).values(
    urls.map((url, i) => ({ albumId, url, caption, sort: maxSort + i + 1 })),
  );
  revalidateAll();
  return { ok: true as const };
}

export async function updatePhotoCaption(id: number, caption: string) {
  await guard();
  await db.update(photos).set({ caption }).where(eq(photos.id, id));
  revalidateAll();
}

export async function deletePhoto(id: number) {
  await guard();
  await db.delete(photos).where(eq(photos.id, id));
  revalidateAll();
}

/* ============ 站点配置 ============ */

export async function saveSettings(config: SiteConfig) {
  await guard();
  await saveSiteConfig(config);
  revalidateAll();
  return { ok: true as const };
}

/* ============ 批量删除（辅助） ============ */

export async function deletePostsByIds(ids: number[]) {
  await guard();
  if (ids.length) {
    await db.delete(postTags).where(inArray(postTags.postId, ids));
    await db.delete(posts).where(inArray(posts.id, ids));
    revalidateAll();
  }
}

export async function ensureAdminExists(username: string, password: string) {
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  if (!existing.length) {
    await db.insert(adminUsers).values({
      username,
      passwordHash: await bcrypt.hash(password, 10),
    });
  }
}
