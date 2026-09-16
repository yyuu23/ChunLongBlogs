"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { comments, friendLinks, stars } from "@/lib/db/schema";
import { guardAdminAction, revalidateSite } from "@/lib/admin/action-utils";

export async function saveFriend(input: {
  id?: number;
  name: string;
  url: string;
  avatar: string;
  description: string;
  sort: number;
}) {
  await guardAdminAction();
  if (!input.name.trim() || !input.url.trim()) return { error: "名称与链接不能为空" };
  const values = {
    name: input.name.trim(),
    url: input.url.trim(),
    avatar: input.avatar ?? "",
    description: input.description ?? "",
    sort: input.sort || 0,
  };
  if (input.id) await db.update(friendLinks).set(values).where(eq(friendLinks.id, input.id));
  else await db.insert(friendLinks).values(values);
  revalidateSite();
  return { ok: true as const };
}

export async function deleteFriend(id: number) {
  await guardAdminAction();
  await db.delete(friendLinks).where(eq(friendLinks.id, id));
  revalidateSite();
}

export async function setStarFeatured(id: number, featured: boolean) {
  await guardAdminAction();
  await db.update(stars).set({ featured: featured ? 1 : 0 }).where(eq(stars.id, id));
  revalidateSite();
}

export async function setStarDeleted(id: number, deleted: boolean) {
  await guardAdminAction();
  await db.update(stars).set({ deletedAt: deleted ? new Date() : null }).where(eq(stars.id, id));
  revalidateSite();
}

export async function setCommentDeleted(id: number, deleted: boolean) {
  await guardAdminAction();
  await db.update(comments).set({ deletedAt: deleted ? new Date() : null }).where(eq(comments.id, id));
  revalidateSite();
}
