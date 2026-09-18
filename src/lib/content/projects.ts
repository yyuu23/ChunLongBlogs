import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts, projectPosts, projects } from "@/lib/db/schema";
import type { PublicProject } from "@/lib/content/types";

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

export async function getProjectsForPost(postId: number): Promise<PublicProject[]> {
  const relations = await db
    .select({ projectId: projectPosts.projectId })
    .from(projectPosts)
    .where(eq(projectPosts.postId, postId));
  if (!relations.length) return [];
  const rows = await db
    .select()
    .from(projects)
    .where(and(inArray(projects.id, relations.map((relation) => relation.projectId)), eq(projects.status, "published")))
    .orderBy(asc(projects.sort), asc(projects.id));
  return attachProjectPosts(rows);
}
