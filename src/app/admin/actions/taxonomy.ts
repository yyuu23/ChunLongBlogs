"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, tags } from "@/lib/db/schema";
import { guardAdminAction, revalidateSite } from "@/lib/admin/action-utils";
import { slugify } from "@/lib/utils";

export async function saveCategory(input: { id?: number; name: string; color?: string }) {
  await guardAdminAction();
  const name = input.name.trim();
  if (!name) return { error: "名称不能为空" };
  const values = { name, slug: slugify(name), color: input.color || "#6366f1" };
  if (input.id) await db.update(categories).set(values).where(eq(categories.id, input.id));
  else await db.insert(categories).values(values).onConflictDoNothing();
  revalidateSite();
  return { ok: true as const };
}

export async function deleteCategory(id: number) {
  await guardAdminAction();
  await db.delete(categories).where(eq(categories.id, id));
  revalidateSite();
}

export async function createTag(name: string) {
  await guardAdminAction();
  const trimmed = name.trim();
  if (!trimmed) return { error: "名称不能为空" };
  await db.insert(tags).values({ name: trimmed, slug: slugify(trimmed) }).onConflictDoNothing();
  revalidateSite();
  return { ok: true as const };
}

export async function deleteTag(id: number) {
  await guardAdminAction();
  await db.delete(tags).where(eq(tags.id, id));
  revalidateSite();
}
