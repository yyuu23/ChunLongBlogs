import { asc, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { albums, moments, photos } from "@/lib/db/schema";
import {
  getCategoriesWithCount,
  getPostBySlug,
  getPublishedPosts,
  getSiteStats,
  getTagsWithCount,
} from "@/lib/posts";

/**
 * AI 聊天的站内数据工具（OpenAI function calling）：
 * 模型按需调用、服务端只读查询 SQLite，让"列出文章/最近说说/相册有哪些"这类
 * 清单与统计问题有真实数据可答，而不是靠 RAG 片段猜或干脆拒绝。
 */

/** OpenAI 协议的工具定义（传给 /chat/completions 的 tools 参数） */
export const CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_posts",
      description:
        "列出本站已发布的文章，按置顶与发布时间倒序。可按分类、标签或关键词过滤。适合「有哪些文章/列个清单/最近写了什么」类问题。",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "分类 slug，可选" },
          tag: { type: "string", description: "标签 slug，可选" },
          keyword: { type: "string", description: "匹配标题/摘要/正文的关键词，可选" },
          limit: { type: "number", description: "返回条数，默认 10，最大 30" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_post",
      description:
        "按 slug 读取一篇文章的完整内容（Markdown）。适合「某篇文章讲了什么/把内容总结一下」类问题。",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "文章 slug，可从 list_posts 结果中获得" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_moments",
      description: "列出站长最近的动态（说说），含内容、心情、位置与日期，按时间倒序。",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "返回条数，默认 10，最大 30" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_albums",
      description: "列出本站全部相册：标题、简介、创建日期、照片数量与部分照片说明文字。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "site_stats",
      description:
        "查询站点统计：已发布文章数/总字数/总浏览、说说数、相册与照片数、分类和标签列表。适合「博客有多少篇文/规模如何」类问题。",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

/** 模型侧看到的工具名集合（执行前校验用） */
const TOOL_NAMES = new Set<string>(CHAT_TOOLS.map((t) => t.function.name));

/* ---------- 参数清洗：模型的输出不可信，一律钳制 ---------- */

const cleanStr = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

const cleanLimit = (v: unknown, def: number, max: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : def;
  return Math.min(Math.max(n, 1), max);
};

const dayOf = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/* ---------- 各工具实现 ---------- */

async function listPosts(args: Record<string, unknown>) {
  const limit = cleanLimit(args.limit, 10, 30);
  const r = await getPublishedPosts({
    category: cleanStr(args.category, 64),
    tag: cleanStr(args.tag, 64),
    q: cleanStr(args.keyword, 64),
    perPage: limit,
  });
  return {
    total: r.total,
    returned: r.items.length,
    posts: r.items.map((p) => ({
      title: p.title,
      url: `/posts/${p.slug}`,
      publishedAt: dayOf(p.publishedAt ?? p.createdAt),
      category: p.category?.name ?? null,
      tags: p.tags.map((t) => t.name),
      description: p.description || null,
      pinned: p.isPinned || undefined,
    })),
  };
}

async function getPost(args: Record<string, unknown>) {
  const slug = cleanStr(args.slug, 128);
  if (!slug || !/^[a-zA-Z0-9-_]+$/.test(slug)) return { error: "slug 格式不合法" };
  const p = await getPostBySlug(slug);
  if (!p || p.status !== "published") return { error: `没有找到已发布的文章「${slug}」` };
  return {
    title: p.title,
    url: `/posts/${p.slug}`,
    publishedAt: dayOf(p.publishedAt ?? p.createdAt),
    category: p.category?.name ?? null,
    tags: p.tags.map((t) => t.name),
    wordCount: p.wordCount,
    readingTimeMinutes: p.readingTime,
    // 超长正文截断，保护上下文窗口
    content:
      p.content.length > 6000 ? `${p.content.slice(0, 6000)}\n\n…（正文过长，已截断）` : p.content,
  };
}

async function listMoments(args: Record<string, unknown>) {
  const limit = cleanLimit(args.limit, 10, 30);
  const [rows, totalRows] = await Promise.all([
    db.select().from(moments).orderBy(desc(moments.createdAt)).limit(limit),
    db.select({ n: sql<number>`count(*)` }).from(moments),
  ]);
  return {
    total: totalRows[0]?.n ?? 0,
    returned: rows.length,
    moments: rows.map((m) => {
      let imageCount = 0;
      try {
        imageCount = (JSON.parse(m.images) as unknown[]).length;
      } catch {}
      return {
        date: dayOf(m.createdAt),
        mood: m.mood || undefined,
        location: m.location || undefined,
        imageCount: imageCount || undefined,
        content: m.content.length > 400 ? `${m.content.slice(0, 400)}…` : m.content,
      };
    }),
  };
}

async function listAlbums() {
  const [albumRows, photoRows, totalRows] = await Promise.all([
    db.select().from(albums).orderBy(asc(albums.createdAt)),
    db
      .select({ albumId: photos.albumId, caption: photos.caption })
      .from(photos)
      .orderBy(asc(photos.sort), asc(photos.id)),
    db.select({ n: sql<number>`count(*)` }).from(photos),
  ]);
  return {
    totalPhotos: totalRows[0]?.n ?? 0,
    albums: albumRows.map((a) => {
      const mine = photoRows.filter((p) => p.albumId === a.id);
      return {
        title: a.title,
        description: a.description || null,
        createdAt: dayOf(a.createdAt),
        photoCount: mine.length,
        // 带说明文字的前几张照片，让模型能讲出相册内容
        photoCaptions: mine
          .filter((p) => p.caption)
          .slice(0, 5)
          .map((p) => p.caption),
      };
    }),
  };
}

async function siteStats() {
  const [stats, cats, tags, momentCount, albumCount, photoCount] = await Promise.all([
    getSiteStats(),
    getCategoriesWithCount(),
    getTagsWithCount(),
    db.select({ n: sql<number>`count(*)` }).from(moments),
    db.select({ n: sql<number>`count(*)` }).from(albums),
    db.select({ n: sql<number>`count(*)` }).from(photos),
  ]);
  return {
    publishedPosts: stats.posts,
    totalWords: stats.words,
    totalPostViews: stats.views,
    moments: momentCount[0]?.n ?? 0,
    albums: albumCount[0]?.n ?? 0,
    photos: photoCount[0]?.n ?? 0,
    categories: cats.filter((c) => c.count > 0).map((c) => ({ name: c.name, slug: c.slug, count: c.count })),
    tags: tags.filter((t) => t.count > 0).map((t) => ({ name: t.name, slug: t.slug, count: t.count })),
  };
}

/**
 * 执行一次工具调用，结果序列化为 JSON 字符串（role:"tool" 消息的 content）。
 * 任何异常都收敛成 {error}——查询失败不该炸掉整轮对话。
 */
export async function executeTool(name: string, argsJson: string): Promise<string> {
  if (!TOOL_NAMES.has(name)) return JSON.stringify({ error: `未知工具：${name}` });
  let args: Record<string, unknown> = {};
  if (argsJson && argsJson.trim()) {
    try {
      args = JSON.parse(argsJson) as Record<string, unknown>;
    } catch {
      return JSON.stringify({ error: "参数不是合法 JSON" });
    }
  }
  try {
    const result =
      name === "list_posts"
        ? await listPosts(args)
        : name === "get_post"
          ? await getPost(args)
          : name === "list_moments"
            ? await listMoments(args)
            : name === "list_albums"
              ? await listAlbums()
              : await siteStats();
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? `查询失败：${e.message}` : "查询失败" });
  }
}
