import { getPostBySlug, getPublishedPosts } from "@/lib/content/posts";
import { getProjectBySlug, getPublishedProjects } from "@/lib/content/projects";
import { recommendContent } from "@/lib/content/recommendations";
import { getPublishedSeries, getSeriesBySlug } from "@/lib/content/series";
import { LAB_DEMOS } from "@/lib/lab/catalog";
import { cleanLimit, cleanStr, dayOf } from "@/lib/chat/tools/args";

export async function listPosts(args: Record<string, unknown>) {
  const limit = cleanLimit(args.limit, 10, 30);
  const result = await getPublishedPosts({
    category: cleanStr(args.category, 64),
    tag: cleanStr(args.tag, 64),
    q: cleanStr(args.keyword, 64),
    perPage: limit,
  });
  return {
    total: result.total,
    returned: result.items.length,
    posts: result.items.map((post) => ({
      title: post.title,
      slug: post.slug,
      url: `/posts/${post.slug}`,
      publishedAt: dayOf(post.publishedAt ?? post.createdAt),
      category: post.category?.name ?? null,
      tags: post.tags.map((tag) => tag.name),
      description: post.description || null,
      cover: post.cover || null,
      pinned: post.isPinned || undefined,
    })),
  };
}

export async function getPost(args: Record<string, unknown>) {
  const slug = cleanStr(args.slug, 128);
  if (!slug || !/^[a-zA-Z0-9-_]+$/.test(slug)) return { error: "slug 格式不合法" };
  const post = await getPostBySlug(slug);
  if (!post || post.status !== "published") return { error: `没有找到已发布的文章「${slug}」` };
  return {
    title: post.title,
    url: `/posts/${post.slug}`,
    publishedAt: dayOf(post.publishedAt ?? post.createdAt),
    category: post.category?.name ?? null,
    tags: post.tags.map((tag) => tag.name),
    wordCount: post.wordCount,
    readingTimeMinutes: post.readingTime,
    content: post.content.length > 6000 ? `${post.content.slice(0, 6000)}\n\n…（正文过长，已截断）` : post.content,
  };
}

export async function listSeries() {
  const items = await getPublishedSeries();
  return {
    total: items.length,
    series: items.map((item) => ({
      title: item.title,
      slug: item.slug,
      url: `/series/${item.slug}`,
      description: item.description,
      postCount: item.postCount,
      totalMinutes: item.totalMinutes,
    })),
  };
}

export async function getSeries(args: Record<string, unknown>) {
  const slug = cleanStr(args.slug, 128);
  if (!slug || !/^[a-zA-Z0-9-_]+$/.test(slug)) return { error: "slug 格式不合法" };
  const item = await getSeriesBySlug(slug);
  if (!item) return { error: `没有找到已发布的系列「${slug}」` };
  return {
    title: item.title,
    url: `/series/${item.slug}`,
    description: item.description,
    totalMinutes: item.totalMinutes,
    posts: item.posts.map((post, index) => ({
      order: index + 1,
      title: post.title,
      url: `/posts/${post.slug}`,
      description: post.description,
      difficulty: post.difficulty,
      readingTimeMinutes: post.readingTime,
    })),
  };
}

export async function listProjects() {
  const items = await getPublishedProjects();
  return {
    total: items.length,
    projects: items.map((item) => ({
      title: item.title,
      slug: item.slug,
      url: `/projects/${item.slug}`,
      summary: item.summary,
      stage: item.stage,
      techStack: item.techStack,
      articleCount: item.posts.length,
      labUrl: item.labSlug ? `/lab/${item.labSlug}` : undefined,
    })),
  };
}

export async function getProject(args: Record<string, unknown>) {
  const slug = cleanStr(args.slug, 128);
  if (!slug || !/^[a-zA-Z0-9-_]+$/.test(slug)) return { error: "slug 格式不合法" };
  const item = await getProjectBySlug(slug);
  if (!item) return { error: `没有找到已发布的项目「${slug}」` };
  return {
    title: item.title,
    url: `/projects/${item.slug}`,
    summary: item.summary,
    stage: item.stage,
    content: item.content.slice(0, 6000),
    techStack: item.techStack,
    repository: item.repoUrl || undefined,
    demo: item.demoUrl || undefined,
    labUrl: item.labSlug ? `/lab/${item.labSlug}` : undefined,
    posts: item.posts.map((post) => ({
      title: post.title,
      url: `/posts/${post.slug}`,
      readingTimeMinutes: post.readingTime,
    })),
  };
}

export function listLabDemos() {
  return {
    total: LAB_DEMOS.length,
    demos: LAB_DEMOS.map((demo) => ({
      title: `${demo.emoji} ${demo.name.zh}`,
      url: `/lab/${demo.slug}`,
      description: demo.desc.zh,
    })),
  };
}

export async function recommendSiteContent(args: Record<string, unknown>) {
  const allowedTypes = new Set(["post", "series", "project", "lab"] as const);
  const types = Array.isArray(args.types)
    ? args.types.filter((item): item is "post" | "series" | "project" | "lab" =>
        typeof item === "string" && allowedTypes.has(item as "post" | "series" | "project" | "lab"),
      )
    : undefined;
  const difficulty = ["beginner", "intermediate", "advanced"].includes(String(args.difficulty))
    ? (args.difficulty as "beginner" | "intermediate" | "advanced")
    : undefined;
  const maxMinutes = typeof args.maxMinutes === "number" && Number.isFinite(args.maxMinutes)
    ? Math.min(Math.max(Math.floor(args.maxMinutes), 1), 1440)
    : undefined;
  const items = await recommendContent({
    keyword: cleanStr(args.keyword, 80),
    types,
    difficulty,
    maxMinutes,
    limit: 3,
  });
  return { returned: items.length, recommendations: items };
}
