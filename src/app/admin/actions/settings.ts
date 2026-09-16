"use server";

import { asc, eq, sql } from "drizzle-orm";
import { llmConfigured, summarizeContent, suggestTags } from "@/lib/ai";
import { guardAdminAction, revalidateSite } from "@/lib/admin/action-utils";
import { db } from "@/lib/db";
import { posts, postTags, tags } from "@/lib/db/schema";
import { saveSiteConfig, type SiteConfig } from "@/lib/site";
import { slugify } from "@/lib/utils";

export async function backfillSummariesAction() {
  await guardAdminAction();
  if (!(await llmConfigured())) {
    return { error: "未配置 AI（DEEPSEEK_API_KEY / GLM_API_KEY / QWEN_API_KEY 任意一家），请在 .env 中设置后重启服务" };
  }

  const rows = await db
    .select({ id: posts.id, title: posts.title, content: posts.content })
    .from(posts)
    .where(eq(posts.description, ""))
    .orderBy(asc(posts.id))
    .limit(5);

  let updated = 0;
  let lastError = "";
  for (const row of rows) {
    const result = await summarizeContent(row.title, row.content);
    if (result.ok) {
      await db
        .update(posts)
        .set({ description: result.summary, updatedAt: new Date() })
        .where(eq(posts.id, row.id));
      updated += 1;
    } else {
      lastError = result.error;
    }
  }

  const remainingRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.description, ""));
  const remaining = remainingRows[0]?.n ?? 0;
  if (updated === 0) return { error: lastError || "没有需要补摘要的文章" };

  revalidateSite();
  return {
    ok: true as const,
    updated,
    remaining,
    message:
      remaining > 0
        ? `已生成 ${updated} 篇，还剩 ${remaining} 篇缺摘要（继续点击即可）`
        : `已生成 ${updated} 篇，全部文章都有摘要了`,
  };
}

export async function backfillTagsAction() {
  await guardAdminAction();
  if (!(await llmConfigured())) {
    return { error: "未配置 AI（DEEPSEEK_API_KEY / GLM_API_KEY / QWEN_API_KEY 任意一家），请在 .env 中设置后重启服务" };
  }

  const existingNames = (
    await db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name))
  ).map((tag) => tag.name);
  const rows = await db
    .select({ id: posts.id, title: posts.title, content: posts.content })
    .from(posts)
    .where(sql`NOT EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = posts.id)`)
    .orderBy(asc(posts.id))
    .limit(5);

  let updated = 0;
  let lastError = "";
  for (const row of rows) {
    const result = await suggestTags(row.title, row.content, existingNames);
    if (!result.ok) {
      lastError = result.error;
      continue;
    }
    for (const name of result.tags) {
      const tagSlug = slugify(name);
      let tag = (await db.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1))[0];
      if (!tag) {
        tag = (await db.insert(tags).values({ name, slug: tagSlug }).returning())[0]!;
        existingNames.push(name);
      }
      await db.insert(postTags).values({ postId: row.id, tagId: tag.id }).onConflictDoNothing();
    }
    updated += 1;
  }

  const remainingRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(posts)
    .where(sql`NOT EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = posts.id)`);
  const remaining = remainingRows[0]?.n ?? 0;
  if (updated === 0) return { error: lastError || "没有需要补标签的文章" };

  revalidateSite();
  return {
    ok: true as const,
    updated,
    remaining,
    message:
      remaining > 0
        ? `已为 ${updated} 篇补上标签，还剩 ${remaining} 篇无标签（继续点击即可）`
        : `已为 ${updated} 篇补上标签，全部文章都有标签了`,
  };
}

export async function rebuildEmbeddingsAction() {
  await guardAdminAction();
  const { rebuildPostEmbeddings, rebuildMomentEmbeddings, embeddingConfigured } = await import(
    "@/lib/rag"
  );
  if (!embeddingConfigured()) {
    return { error: "未配置 EMBEDDING_API_KEY（当前问答走关键词检索，功能可用但语义匹配较弱）" };
  }
  try {
    const postsResult = await rebuildPostEmbeddings();
    if (!("ok" in postsResult)) return { error: postsResult.error };
    const momentsResult = await rebuildMomentEmbeddings();
    if (!("ok" in momentsResult)) return { error: momentsResult.error };
    return {
      ok: true as const,
      message: `已为 ${postsResult.posts} 篇文章、${momentsResult.moments} 条说说生成 ${postsResult.chunks + momentsResult.chunks} 个向量块`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "重建失败" };
  }
}

export async function saveSettings(config: SiteConfig) {
  await guardAdminAction();
  await saveSiteConfig(config);
  revalidateSite();
  return { ok: true as const };
}
