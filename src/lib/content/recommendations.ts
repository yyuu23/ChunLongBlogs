import "server-only";

import { and, asc, eq, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { LAB_DEMOS } from "@/lib/lab/catalog";
import { getPublishedProjects } from "@/lib/content/projects";
import { getPublishedSeries } from "@/lib/content/series";
import type {
  ContentRecommendation,
  ContentRecommendationType,
  Difficulty,
} from "@/lib/content/types";

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
        title: posts.title,
        slug: posts.slug,
        description: posts.description,
        cover: posts.cover,
        readingTime: posts.readingTime,
        difficulty: posts.difficulty,
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
      if (keyword && !`${item.title} ${item.description}`.includes(keyword)) continue;
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
      if (keyword && !`${item.title} ${item.summary} ${item.techStack.join(" ")}`.includes(keyword)) continue;
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
