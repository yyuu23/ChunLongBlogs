"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { moments } from "@/lib/db/schema";
import { guardAdminAction, revalidateSite } from "@/lib/admin/action-utils";

export async function saveMoment(input: {
  id?: number;
  content: string;
  images: string[];
  mood?: string;
  location?: string;
}) {
  await guardAdminAction();
  if (!input.content.trim()) return { error: "内容不能为空" };
  const values = {
    content: input.content.trim(),
    images: JSON.stringify(input.images),
    mood: input.mood ?? "",
    location: input.location ?? "",
  };
  let momentId = input.id;
  if (input.id) await db.update(moments).set(values).where(eq(moments.id, input.id));
  else momentId = (await db.insert(moments).values(values).returning())[0]!.id;
  revalidateSite();
  if (momentId) {
    try {
      const { rebuildMomentEmbeddings } = await import("@/lib/rag");
      void rebuildMomentEmbeddings(momentId).catch(() => {});
    } catch {}
  }
  return { ok: true as const };
}

export async function deleteMoment(id: number) {
  await guardAdminAction();
  await db.delete(moments).where(eq(moments.id, id));
  try {
    const { deleteEmbeddings } = await import("@/lib/rag");
    await deleteEmbeddings("moment", id);
  } catch {}
  revalidateSite();
}
