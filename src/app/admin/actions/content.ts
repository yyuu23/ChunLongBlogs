"use server";

import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { posts, projectPosts, projects, series } from "@/lib/db/schema";
import { guardAdminAction, revalidateSite } from "@/lib/admin/action-utils";
import { chatLLM } from "@/lib/ai";
import { getPostTagNames } from "@/lib/content-hub";
import type { SeriesProposal } from "@/lib/content-types";
import { slugify } from "@/lib/utils";
import { LAB_DEMOS } from "@/lib/lab-demos";

const seriesInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(80),
    slug: z.string().trim().max(100).optional(),
    description: z.string().trim().max(500).default(""),
    cover: z.string().trim().max(500).default(""),
    status: z.enum(["draft", "published"]),
    sort: z.number().int().min(0).max(10_000).default(0),
  })
  .strict();

const projectInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(100),
    slug: z.string().trim().max(100).optional(),
    summary: z.string().trim().max(500).default(""),
    content: z.string().max(30_000).default(""),
    cover: z.string().trim().max(500).default(""),
    status: z.enum(["draft", "published"]),
    stage: z.enum(["planned", "in_progress", "maintaining", "completed", "archived"]),
    techStack: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    repoUrl: z.string().trim().max(500).default(""),
    demoUrl: z.string().trim().max(500).default(""),
    labSlug: z.string().trim().max(80).nullable().optional(),
    sort: z.number().int().min(0).max(10_000).default(0),
    startedAt: z.string().datetime().nullable().optional(),
    postIds: z.array(z.number().int().positive()).max(100).default([]),
  })
  .strict();

const proposalSchema = z
  .object({
    groups: z
      .array(
        z
          .object({
            existingSeriesId: z.number().int().positive().optional(),
            newSeries: z
              .object({
                title: z.string().trim().min(1).max(80),
                slug: z.string().trim().min(1).max(100),
                description: z.string().trim().max(500),
              })
              .strict()
              .optional(),
            items: z
              .array(
                z
                  .object({
                    postId: z.number().int().positive(),
                    order: z.number().int().min(0).max(10_000),
                    reason: z.string().trim().max(300),
                  })
                  .strict(),
              )
              .min(1)
              .max(100),
          })
          .strict()
          .refine((value) => Boolean(value.existingSeriesId) !== Boolean(value.newSeries), {
            message: "每组必须且只能指定已有系列或新系列",
          }),
      )
      .max(20),
    unassignedPostIds: z.array(z.number().int().positive()).max(200).default([]),
    notes: z.array(z.string().trim().max(300)).max(20).default([]),
  })
  .strict();

function cleanSlug(value: string | undefined, title: string) {
  return (value?.trim() || slugify(title))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function uniqueSlug(
  table: typeof series | typeof projects,
  slug: string,
  currentId?: number,
) {
  let candidate = slug || `item-${Date.now().toString(36)}`;
  const rows = await db.select({ id: table.id }).from(table).where(eq(table.slug, candidate)).limit(1);
  if (rows[0] && rows[0].id !== currentId) candidate = `${candidate}-${Date.now().toString(36).slice(-4)}`;
  return candidate;
}

export async function saveSeries(input: unknown) {
  await guardAdminAction();
  const parsed = seriesInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "系列数据不合法" };
  const value = parsed.data;
  const slug = await uniqueSlug(series, cleanSlug(value.slug, value.title), value.id);
  const payload = {
    title: value.title,
    slug,
    description: value.description,
    cover: value.cover,
    status: value.status,
    sort: value.sort,
    updatedAt: new Date(),
  };
  let id: number = value.id ?? 0;
  if (value.id) {
    await db.update(series).set(payload).where(eq(series.id, value.id));
  } else {
    const [created] = await db.insert(series).values({ ...payload, createdAt: new Date() }).returning({ id: series.id });
    id = created!.id;
  }
  revalidateSite();
  return { ok: true as const, id };
}

export async function deleteSeries(id: number) {
  await guardAdminAction();
  if (!Number.isInteger(id) || id <= 0) return { error: "系列 ID 不合法" };
  await db.delete(series).where(eq(series.id, id));
  revalidateSite();
  return { ok: true as const };
}

export async function assignSeriesPosts(
  seriesId: number,
  items: Array<{ postId: number; order: number }>,
) {
  await guardAdminAction();
  if (!Number.isInteger(seriesId) || seriesId <= 0) return { error: "系列 ID 不合法" };
  const [target] = await db.select({ id: series.id }).from(series).where(eq(series.id, seriesId)).limit(1);
  if (!target) return { error: "系列不存在" };
  const clean = items
    .filter((item) => Number.isInteger(item.postId) && item.postId > 0)
    .slice(0, 200)
    .map((item, index) => ({ postId: item.postId, order: index + 1 }));
  const valid = clean.length
    ? new Set(
        (await db.select({ id: posts.id }).from(posts).where(inArray(posts.id, clean.map((item) => item.postId)))).map(
          (row) => row.id,
        ),
      )
    : new Set<number>();
  db.$client.transaction(() => {
    db.update(posts).set({ seriesId: null, seriesOrder: 0 }).where(eq(posts.seriesId, seriesId)).run();
    for (const item of clean) {
      if (valid.has(item.postId)) {
        db.update(posts)
          .set({ seriesId, seriesOrder: item.order })
          .where(eq(posts.id, item.postId))
          .run();
      }
    }
  })();
  revalidateSite();
  return { ok: true as const };
}

export async function saveProject(input: unknown) {
  await guardAdminAction();
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "项目数据不合法" };
  const value = parsed.data;
  if (value.labSlug && !LAB_DEMOS.some((demo) => demo.slug === value.labSlug)) {
    return { error: "关联的实验不存在" };
  }
  const slug = await uniqueSlug(projects, cleanSlug(value.slug, value.title), value.id);
  const postIds = [...new Set(value.postIds)];
  const validPostIds = postIds.length
    ? new Set(
        (await db.select({ id: posts.id }).from(posts).where(inArray(posts.id, postIds))).map((row) => row.id),
      )
    : new Set<number>();
  let projectId = value.id ?? 0;
  db.$client.transaction(() => {
    const payload = {
      title: value.title,
      slug,
      summary: value.summary,
      content: value.content,
      cover: value.cover,
      status: value.status,
      stage: value.stage,
      techStack: JSON.stringify(value.techStack),
      repoUrl: value.repoUrl,
      demoUrl: value.demoUrl,
      labSlug: value.labSlug || null,
      sort: value.sort,
      startedAt: value.startedAt ? new Date(value.startedAt) : null,
      updatedAt: new Date(),
    };
    if (value.id) {
      db.update(projects).set(payload).where(eq(projects.id, value.id)).run();
    } else {
      projectId = db.insert(projects).values({ ...payload, createdAt: new Date() }).returning({ id: projects.id }).get()!.id;
    }
    db.delete(projectPosts).where(eq(projectPosts.projectId, projectId)).run();
    postIds.forEach((postId, index) => {
      if (validPostIds.has(postId)) {
        db.insert(projectPosts).values({ projectId, postId, sort: index + 1 }).run();
      }
    });
  })();
  revalidateSite();
  return { ok: true as const };
}

export async function deleteProject(id: number) {
  await guardAdminAction();
  if (!Number.isInteger(id) || id <= 0) return { error: "项目 ID 不合法" };
  await db.delete(projects).where(eq(projects.id, id));
  revalidateSite();
  return { ok: true as const };
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

export async function suggestSeriesOrganization(): Promise<
  { ok: true; proposal: SeriesProposal } | { error: string }
> {
  await guardAdminAction();
  const [postRows, seriesRows] = await Promise.all([
    db.select().from(posts).orderBy(asc(posts.createdAt)),
    db.select().from(series).orderBy(asc(series.sort), asc(series.id)),
  ]);
  if (!postRows.length) return { error: "没有可整理的文章" };
  const tagMap = await getPostTagNames(postRows.map((post) => post.id));
  const source = {
    existingSeries: seriesRows.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
    })),
    posts: postRows.map((post) => ({
      id: post.id,
      title: post.title,
      description: post.description,
      tags: tagMap.get(post.id) ?? [],
      currentSeriesId: post.seriesId,
      excerpt: post.content.replace(/```[\s\S]*?```/g, "").slice(0, 500),
    })),
  };
  const result = await chatLLM(
    "你是技术博客的信息架构编辑。根据已有系列和文章，为文章生成单层、有明确阅读顺序的系列整理建议。" +
      "优先复用已有系列；确实不合适才建议新系列；不要为了凑数量强行归类。" +
      "只输出合法 JSON，不要 Markdown。格式：" +
      '{"groups":[{"existingSeriesId":1,"items":[{"postId":2,"order":1,"reason":"理由"}]},{"newSeries":{"title":"标题","slug":"english-slug","description":"简介"},"items":[]}],"unassignedPostIds":[],"notes":[]}。' +
      "每篇文章最多出现一次，所有 ID 必须来自输入。",
    JSON.stringify(source),
    { maxTokens: 3000, temperature: 0.2, timeoutMs: 90_000 },
  );
  if (!result.ok) return { error: result.error };
  const parsed = proposalSchema.safeParse(extractJson(result.content));
  if (!parsed.success) return { error: "AI 返回的系列方案格式不正确，请重试" };

  const postIds = new Set(postRows.map((post) => post.id));
  const seriesIds = new Set(seriesRows.map((item) => item.id));
  const seen = new Set<number>();
  const groups = parsed.data.groups
    .filter((group) => !group.existingSeriesId || seriesIds.has(group.existingSeriesId))
    .map((group) => ({
      ...group,
      newSeries: group.newSeries
        ? { ...group.newSeries, slug: cleanSlug(group.newSeries.slug, group.newSeries.title) }
        : undefined,
      items: group.items
        .filter((item) => postIds.has(item.postId) && !seen.has(item.postId) && (seen.add(item.postId) || true))
        .sort((a, b) => a.order - b.order)
        .map((item, index) => ({ ...item, order: index + 1 })),
    }))
    .filter((group) => group.items.length > 0);
  return {
    ok: true,
    proposal: {
      groups,
      unassignedPostIds: parsed.data.unassignedPostIds.filter((id) => postIds.has(id) && !seen.has(id)),
      notes: parsed.data.notes,
    },
  };
}

export async function applySeriesProposal(input: unknown) {
  await guardAdminAction();
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "系列方案不合法" };
  const [postRows, seriesRows] = await Promise.all([
    db.select({ id: posts.id }).from(posts),
    db.select({ id: series.id }).from(series),
  ]);
  const postIds = new Set(postRows.map((row) => row.id));
  const seriesIds = new Set(seriesRows.map((row) => row.id));
  const seen = new Set<number>();
  for (const group of parsed.data.groups) {
    if (group.existingSeriesId && !seriesIds.has(group.existingSeriesId)) return { error: "方案引用了不存在的系列" };
    for (const item of group.items) {
      if (!postIds.has(item.postId)) return { error: "方案引用了不存在的文章" };
      if (seen.has(item.postId)) return { error: "同一篇文章不能出现在多个系列" };
      seen.add(item.postId);
    }
  }

  db.$client.transaction(() => {
    for (const group of parsed.data.groups) {
      let seriesId = group.existingSeriesId ?? 0;
      if (group.newSeries) {
        let slug = cleanSlug(group.newSeries.slug, group.newSeries.title);
        const taken = db.select({ id: series.id }).from(series).where(eq(series.slug, slug)).get();
        if (taken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        seriesId = db
          .insert(series)
          .values({
            title: group.newSeries.title,
            slug,
            description: group.newSeries.description,
            status: "draft",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: series.id })
          .get()!.id;
      }
      group.items.forEach((item, index) => {
        db.update(posts)
          .set({ seriesId, seriesOrder: index + 1 })
          .where(eq(posts.id, item.postId))
          .run();
      });
    }
  })();
  revalidateSite();
  return { ok: true as const };
}
