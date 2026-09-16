"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { guardAdminAction, revalidateSite } from "@/lib/admin/action-utils";

export async function saveAlbum(input: { id?: number; title: string; description: string; cover: string }) {
  await guardAdminAction();
  if (!input.title.trim()) return { error: "标题不能为空" };
  const values = { title: input.title.trim(), description: input.description ?? "", cover: input.cover ?? "" };
  if (input.id) await db.update(albums).set(values).where(eq(albums.id, input.id));
  else await db.insert(albums).values(values);
  revalidateSite();
  return { ok: true as const };
}

export async function deleteAlbum(id: number) {
  await guardAdminAction();
  await db.delete(albums).where(eq(albums.id, id));
  revalidateSite();
}

export async function addPhotos(albumId: number, urls: string[], caption = "") {
  await guardAdminAction();
  if (!urls.length) return { error: "没有图片" };
  const maxSort = (await db.select({ sort: photos.sort }).from(photos).where(eq(photos.albumId, albumId))).reduce(
    (max, row) => Math.max(max, row.sort),
    0,
  );
  await db.insert(photos).values(urls.map((url, i) => ({ albumId, url, caption, sort: maxSort + i + 1 })));
  revalidateSite();
  return { ok: true as const };
}

export async function updatePhotoCaption(id: number, caption: string) {
  await guardAdminAction();
  await db.update(photos).set({ caption }).where(eq(photos.id, id));
  revalidateSite();
}

export async function deletePhoto(id: number) {
  await guardAdminAction();
  await db.delete(photos).where(eq(photos.id, id));
  revalidateSite();
}
