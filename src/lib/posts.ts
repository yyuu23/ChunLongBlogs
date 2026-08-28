import { and, desc, eq, inArray, like, or, sql, asc } from "drizzle-orm";
import { db } from "./db";
import {
  categories,
  postTags,
  posts as postsTable,
  tags as tagsTable,
} from "./db/schema";

export interface PostListItem {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover: string;
  category: { id: number; name: string; slug: string; color: string } | null;
  tags: { id: number; name: string; slug: string }[];
  isPinned: boolean;
  views: number;
  wordCount: number;
  readingTime: number;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface QueryOptions {
  category?: string;
  tag?: string;
  q?: string;
  page?: number;
  perPage?: number;
}

function baseSelect() {
  return db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      slug: postsTable.slug,
      description: postsTable.description,
      cover: postsTable.cover,
      isPinned: postsTable.isPinned,
      views: postsTable.views,
      wordCount: postsTable.wordCount,
      readingTime: postsTable.readingTime,
      createdAt: postsTable.createdAt,
      publishedAt: postsTable.publishedAt,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      categoryColor: categories.color,
    })
    .from(postsTable)
    .leftJoin(categories, eq(postsTable.categoryId, categories.id));
}

type Row = Awaited<ReturnType<ReturnType<typeof baseSelect>["execute"]>>[number];

function toItem(row: Row): PostListItem & { categoryId: number | null } {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    cover: row.cover,
    category:
      row.categoryId != null
        ? {
            id: row.categoryId,
            name: row.categoryName ?? "",
            slug: row.categorySlug ?? "",
            color: row.categoryColor ?? "#6366f1",
          }
        : null,
    tags: [],
    isPinned: row.isPinned,
    views: row.views,
    wordCount: row.wordCount,
    readingTime: row.readingTime,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
    categoryId: row.categoryId,
  };
}

async function attachTags(items: Array<PostListItem & { categoryId: number | null }>) {
  if (!items.length) return items as PostListItem[];
  const ids = items.map((i) => i.id);
  const rel = await db
    .select({
      postId: postTags.postId,
      id: tagsTable.id,
      name: tagsTable.name,
      slug: tagsTable.slug,
    })
    .from(postTags)
    .innerJoin(tagsTable, eq(postTags.tagId, tagsTable.id))
    .where(inArray(postTags.postId, ids));
  for (const item of items) {
    item.tags = rel
      .filter((r) => r.postId === item.id)
      .map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
  }
  return items as PostListItem[];
}

async function tagIdBySlug(slug: string) {
  const rows = await db
    .select({ id: tagsTable.id })
    .from(tagsTable)
    .where(eq(tagsTable.slug, slug))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getPublishedPosts(opts: QueryOptions = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 10;

  const conditions = [eq(postsTable.status, "published")];
  if (opts.category) {
    conditions.push(eq(categories.slug, opts.category));
  }
  if (opts.tag) {
    const tid = await tagIdBySlug(opts.tag);
    if (tid == null) return { items: [], total: 0, page, perPage };
    conditions.push(
      sql`EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = ${postsTable.id} AND pt.tag_id = ${tid})`,
    );
  }
  if (opts.q) {
    const kw = `%${opts.q}%`;
    const likeCond = or(
      like(postsTable.title, kw),
      like(postsTable.description, kw),
      like(postsTable.content, kw),
    );
    if (likeCond) conditions.push(likeCond);
  }

  const where = and(...conditions);

  const rows = await baseSelect()
    .where(where)
    .orderBy(desc(postsTable.isPinned), desc(postsTable.publishedAt), desc(postsTable.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const countRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(postsTable)
    .leftJoin(categories, eq(postsTable.categoryId, categories.id))
    .where(where);

  return {
    items: await attachTags(rows.map(toItem)),
    total: countRows[0]?.n ?? 0,
    page,
    perPage,
  };
}

export async function getPostBySlug(slug: string) {
  const rows = await baseSelect().where(eq(postsTable.slug, slug)).limit(1);
  if (!rows.length) return null;
  const row = rows[0];
  if (row === undefined) return null;
  const full = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, row.id))
    .limit(1);
  const [item] = await attachTags([toItem(row)]);
  return { ...item, content: full[0]?.content ?? "", status: full[0]?.status ?? "draft" };
}

export async function getNeighborPosts(publishedAt: Date | null, id: number) {
  const base = eq(postsTable.status, "published");
  if (!publishedAt) return { prev: null, next: null };
  const prevRows = await db
    .select({ title: postsTable.title, slug: postsTable.slug })
    .from(postsTable)
    .where(and(base, sql`(${postsTable.publishedAt} < ${publishedAt.getTime()} OR (${postsTable.publishedAt} = ${publishedAt.getTime()} AND ${postsTable.id} < ${id}))`))
    .orderBy(desc(postsTable.publishedAt), desc(postsTable.id))
    .limit(1);
  const nextRows = await db
    .select({ title: postsTable.title, slug: postsTable.slug })
    .from(postsTable)
    .where(and(base, sql`(${postsTable.publishedAt} > ${publishedAt.getTime()} OR (${postsTable.publishedAt} = ${publishedAt.getTime()} AND ${postsTable.id} > ${id}))`))
    .orderBy(asc(postsTable.publishedAt), asc(postsTable.id))
    .limit(1);
  return { prev: prevRows[0] ?? null, next: nextRows[0] ?? null };
}

export async function getCategoriesWithCount() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      color: categories.color,
      count: sql<number>`(SELECT count(*) FROM posts p WHERE p.category_id = ${categories.id} AND p.status = 'published')`,
    })
    .from(categories)
    .orderBy(asc(categories.id));
}

export async function getTagsWithCount() {
  return db
    .select({
      id: tagsTable.id,
      name: tagsTable.name,
      slug: tagsTable.slug,
      count: sql<number>`(SELECT count(*) FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE pt.tag_id = ${tagsTable.id} AND p.status = 'published')`,
    })
    .from(tagsTable)
    .orderBy(asc(tagsTable.id));
}

export async function getArchive() {
  const rows = await baseSelect()
    .where(eq(postsTable.status, "published"))
    .orderBy(desc(postsTable.publishedAt), desc(postsTable.createdAt));
  return rows.map(toItem);
}

export async function getSiteStats() {
  const rows = await db
    .select({
      posts: sql<number>`count(*)`,
      words: sql<number>`coalesce(sum(${postsTable.wordCount}), 0)`,
      views: sql<number>`coalesce(sum(${postsTable.views}), 0)`,
    })
    .from(postsTable)
    .where(eq(postsTable.status, "published"));
  return rows[0] ?? { posts: 0, words: 0, views: 0 };
}
