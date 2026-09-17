import { and, asc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  postTags,
  posts,
  projectPosts,
  projects,
  series,
  tags,
} from "@/lib/db/schema";
import { LAB_DEMOS } from "@/lib/lab-demos";
import type { ContentRecommendation, ContentRecommendationType } from "@/lib/content-types";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface PublicSeriesSummary {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover: string;
  postCount: number;
  totalMinutes: number;
}

export interface SeriesPostItem {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover: string;
  order: number;
  difficulty: Difficulty | null;
  readingTime: number;
  publishedAt: Date | null;
}

export interface PublicSeriesDetail extends PublicSeriesSummary {
  posts: SeriesPostItem[];
}

export interface PublicProject {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  cover: string;
  techStack: string[];
  repoUrl: string;
  demoUrl: string;
  labSlug: string | null;
  stage: "planned" | "in_progress" | "maintaining" | "completed" | "archived";
  sort: number;
  startedAt: Date | null;
  updatedAt: Date;
  posts: Array<{ id: number; title: string; slug: string; description: string; readingTime: number }>;
}

function parseTechStack(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && !!item.trim()).slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

export async function getPublishedSeries(): Promise<PublicSeriesSummary[]> {
  const [seriesRows, postRows] = await Promise.all([
    db.select().from(series).where(eq(series.status, "published")).orderBy(asc(series.sort), asc(series.id)),
    db
      .select({ seriesId: posts.seriesId, readingTime: posts.readingTime })
      .from(posts)
      .where(eq(posts.status, "published")),
  ]);
  return seriesRows.map((item) => {
    const mine = postRows.filter((post) => post.seriesId === item.id);
    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      description: item.description,
      cover: item.cover,
      postCount: mine.length,
      totalMinutes: mine.reduce((sum, post) => sum + post.readingTime, 0),
    };
  });
}

export async function getSeriesBySlug(slug: string): Promise<PublicSeriesDetail | null> {
  const [item] = await db
    .select()
    .from(series)
    .where(and(eq(series.slug, slug), eq(series.status, "published")))
    .limit(1);
  if (!item) return null;
  const articleRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      description: posts.description,
      cover: posts.cover,
      order: posts.seriesOrder,
      difficulty: posts.difficulty,
      readingTime: posts.readingTime,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(and(eq(posts.seriesId, item.id), eq(posts.status, "published")))
    .orderBy(asc(posts.seriesOrder), asc(posts.publishedAt), asc(posts.id));
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    description: item.description,
    cover: item.cover,
    postCount: articleRows.length,
    totalMinutes: articleRows.reduce((sum, post) => sum + post.readingTime, 0),
    posts: articleRows,
  };
}

export async function getSeriesForPost(postId: number) {
  const [post] = await db
    .select({ seriesId: posts.seriesId, order: posts.seriesOrder })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!post?.seriesId) return null;
  const [item] = await db
    .select()
    .from(series)
    .where(and(eq(series.id, post.seriesId), eq(series.status, "published")))
    .limit(1);
  if (!item) return null;
  const entries = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      order: posts.seriesOrder,
      readingTime: posts.readingTime,
      difficulty: posts.difficulty,
    })
    .from(posts)
    .where(and(eq(posts.seriesId, item.id), eq(posts.status, "published")))
    .orderBy(asc(posts.seriesOrder), asc(posts.id));
  const index = entries.findIndex((entry) => entry.id === postId);
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    description: item.description,
    entries,
    current: index >= 0 ? index + 1 : 0,
    total: entries.length,
    prev: index > 0 ? entries[index - 1] : null,
    next: index >= 0 && index < entries.length - 1 ? entries[index + 1] : null,
  };
}

export async function getPublishedProjects(): Promise<PublicProject[]> {
  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.status, "published"))
    .orderBy(asc(projects.sort), asc(projects.id));
  return attachProjectPosts(projectRows);
}

export async function getProjectBySlug(slug: string): Promise<PublicProject | null> {
  const [item] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.status, "published")))
    .limit(1);
  if (!item) return null;
  return (await attachProjectPosts([item]))[0] ?? null;
}

async function attachProjectPosts(projectRows: Array<typeof projects.$inferSelect>): Promise<PublicProject[]> {
  const ids = projectRows.map((item) => item.id);
  const relations = ids.length
    ? await db
        .select({
          projectId: projectPosts.projectId,
          sort: projectPosts.sort,
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          description: posts.description,
          readingTime: posts.readingTime,
        })
        .from(projectPosts)
        .innerJoin(posts, eq(projectPosts.postId, posts.id))
        .where(and(inArray(projectPosts.projectId, ids), eq(posts.status, "published")))
        .orderBy(asc(projectPosts.sort), asc(posts.id))
    : [];
  return projectRows.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    content: item.content,
    cover: item.cover,
    techStack: parseTechStack(item.techStack),
    repoUrl: item.repoUrl,
    demoUrl: item.demoUrl,
    labSlug: item.labSlug,
    stage: item.stage,
    sort: item.sort,
    startedAt: item.startedAt,
    updatedAt: item.updatedAt,
    posts: relations
      .filter((relation) => relation.projectId === item.id)
      .map(({ id, title, slug, description, readingTime }) => ({ id, title, slug, description, readingTime })),
  }));
}

export async function getProjectsForPost(postId: number): Promise<PublicProject[]> {
  const relations = await db
    .select({ projectId: projectPosts.projectId })
    .from(projectPosts)
    .where(eq(projectPosts.postId, postId));
  if (!relations.length) return [];
  const rows = await db
    .select()
    .from(projects)
    .where(and(inArray(projects.id, relations.map((r) => r.projectId)), eq(projects.status, "published")))
    .orderBy(asc(projects.sort), asc(projects.id));
  return attachProjectPosts(rows);
}

export async function recommendContent(input: {
  keyword?: string;
  types?: ContentRecommendationType[];
  maxMinutes?: number;
  difficulty?: Difficulty;
  limit?: number;
}): Promise<ContentRecommendation[]> {
  const keyword = input.keyword?.trim().slice(0, 80) ?? "";
  const types = new Set(input.types?.length ? input.types : ["post", "series", "project", "lab"]);
  const limit = Math.min(Math.max(input.limit ?? 3, 1), 3);
  const results: Array<ContentRecommendation & { score: number }> = [];

  if (types.has("post")) {
    const condition = keyword
      ? and(
          eq(posts.status, "published"),
          or(like(posts.title, `%${keyword}%`), like(posts.description, `%${keyword}%`), like(posts.content, `%${keyword}%`)),
        )
      : eq(posts.status, "published");
    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        description: posts.description,
        cover: posts.cover,
        readingTime: posts.readingTime,
        difficulty: posts.difficulty,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(condition)
      .orderBy(asc(posts.readingTime), asc(posts.id));
    for (const row of rows) {
      if (input.maxMinutes && row.readingTime > input.maxMinutes) continue;
      if (input.difficulty && row.difficulty && row.difficulty !== input.difficulty) continue;
      results.push({
        type: "post",
        title: row.title,
        url: `/posts/${row.slug}`,
        description: row.description,
        reason: keyword ? `内容与“${keyword}”相关` : "适合从一篇文章开始阅读",
        minutes: row.readingTime,
        difficulty: row.difficulty ?? undefined,
        cover: row.cover || undefined,
        score: keyword && `${row.title} ${row.description}`.includes(keyword) ? 8 : 3,
      });
    }
  }

  if (types.has("series")) {
    for (const item of await getPublishedSeries()) {
      const matched = !keyword || `${item.title} ${item.description}`.includes(keyword);
      if (!matched) continue;
      results.push({
        type: "series",
        title: item.title,
        url: `/series/${item.slug}`,
        description: item.description,
        reason: `${item.postCount} 篇文章按顺序组织，适合系统阅读`,
        minutes: item.totalMinutes,
        cover: item.cover || undefined,
        score: keyword ? 7 : 4,
      });
    }
  }

  if (types.has("project")) {
    for (const item of await getPublishedProjects()) {
      const matched = !keyword || `${item.title} ${item.summary} ${item.techStack.join(" ")}`.includes(keyword);
      if (!matched) continue;
      results.push({
        type: "project",
        title: item.title,
        url: `/projects/${item.slug}`,
        description: item.summary,
        reason: item.posts.length ? `包含 ${item.posts.length} 篇实现文章` : "可以了解完整的项目背景与技术取舍",
        cover: item.cover || undefined,
        score: keyword ? 7 : 3,
      });
    }
  }

  if (types.has("lab")) {
    for (const demo of LAB_DEMOS) {
      const text = `${demo.name.zh} ${demo.desc.zh}`;
      if (keyword && !text.includes(keyword)) continue;
      results.push({
        type: "lab",
        title: `${demo.emoji} ${demo.name.zh}`,
        url: `/lab/${demo.slug}`,
        description: demo.desc.zh,
        reason: "可以直接动手体验，不需要前置阅读",
        score: keyword ? 6 : 2,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      type: item.type,
      title: item.title,
      url: item.url,
      description: item.description,
      reason: item.reason,
      minutes: item.minutes,
      difficulty: item.difficulty,
      cover: item.cover,
    }));
}

export async function getPostTagNames(postIds: number[]) {
  if (!postIds.length) return new Map<number, string[]>();
  const rows = await db
    .select({ postId: postTags.postId, name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, postIds));
  const result = new Map<number, string[]>();
  for (const row of rows) result.set(row.postId, [...(result.get(row.postId) ?? []), row.name]);
  return result;
}
