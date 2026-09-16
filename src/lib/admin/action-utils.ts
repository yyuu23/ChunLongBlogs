import "server-only";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";

export async function guardAdminAction() {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  return session;
}

export function revalidateSite() {
  revalidatePath("/", "layout");
}
