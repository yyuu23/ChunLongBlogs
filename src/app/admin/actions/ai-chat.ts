"use server";

import { guardAdminAction, revalidateSite } from "@/lib/admin/action-utils";
import { sanitizeAiChatConfig } from "@/lib/admin/ai-chat-config";
import { getSiteConfig, saveSiteConfig, type AiChatConfig } from "@/lib/site";

export async function saveAiChat(input: AiChatConfig) {
  await guardAdminAction();
  const result = sanitizeAiChatConfig(input);
  if (!result.ok) return { error: result.error };

  const current = await getSiteConfig();
  await saveSiteConfig({ ...current, aiChat: result.config });
  revalidateSite();
  return { ok: true as const };
}
