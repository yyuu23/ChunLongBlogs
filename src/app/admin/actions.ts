"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  adminUsers,
  albums,
  categories,
  friendLinks,
  moments,
  photos,
  playlists,
  postTags,
  posts,
  songs,
  tags,
} from "@/lib/db/schema";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { llmConfigured, summarizeContent, suggestTags } from "@/lib/ai";
import { saveSiteConfig, getSiteConfig, type SiteConfig, type AiChatConfig } from "@/lib/site";
import { countWords, excerpt, readingTimeMinutes, slugify } from "@/lib/utils";

async function guard() {
  const session = await getSession();
  if (!session) throw new Error("未登录");
  return session;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/* ============ 登录 / 退出 ============ */

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return "请输入账号和密码";

  const rows = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return "账号或密码错误";
  }
  await createSession(username);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

/* ============ 文章 ============ */

export interface PostInput {
  id?: number;
  title: string;
  slug?: string;
  description?: string;
  content: string;
  cover?: string;
  categoryId?: number | null;
  tagNames: string[];
  status: "draft" | "published";
  isPinned?: boolean;
  publishedAt?: string | null;
}

export async function savePost(input: PostInput) {
  await guard();
  const title = input.title.trim();
  if (!title) return { error: "标题不能为空" };
  const content = input.content ?? "";

  let slug = (input.slug ?? "").trim() || slugify(title);
  // slug 唯一性：冲突时追加随机后缀
  const conflict = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.slug, slug))
    .limit(1);
  if (conflict[0] && conflict[0].id !== input.id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const payload = {
    title,
    slug,
    // 留空时截正文兜底：走 excerpt 清洗（去代码块/Markdown 标记），列表卡/RSS/SEO 描述不漏原文符号
    description: (input.description ?? "").trim() || excerpt(content, 100),
    content,
    cover: input.cover ?? "",
    categoryId: input.categoryId ?? null,
    status: input.status,
    isPinned: input.isPinned ?? false,
    wordCount: countWords(content),
    readingTime: readingTimeMinutes(content),
    updatedAt: new Date(),
    publishedAt:
      input.status === "published"
        ? input.publishedAt
          ? new Date(input.publishedAt)
          : new Date()
        : null,
  };

  let postId: number;
  if (input.id) {
    await db.update(posts).set(payload).where(eq(posts.id, input.id));
    postId = input.id;
  } else {
    const [row] = await db
      .insert(posts)
      .values({ ...payload, createdAt: new Date() })
      .returning();
    postId = row.id;
  }

  // 标签关联
  await db.delete(postTags).where(eq(postTags.postId, postId));
  for (const name of input.tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const tslug = slugify(trimmed);
    let tagRow = (await db.select().from(tags).where(eq(tags.slug, tslug)).limit(1))[0];
    if (!tagRow) {
      tagRow = (await db.insert(tags).values({ name: trimmed, slug: tslug }).returning())[0];
    }
    await db.insert(postTags).values({ postId, tagId: tagRow.id }).onConflictDoNothing();
  }

  revalidateAll();
  // 已发布文章自动更新向量索引（失败不影响保存）
  if (input.status === "published") {
    try {
      const { rebuildPostEmbeddings } = await import("@/lib/rag");
      void rebuildPostEmbeddings(postId).catch(() => {});
    } catch {}
  }
  return { ok: true as const, id: postId, slug };
}

export async function deletePost(id: number) {
  await guard();
  await db.delete(posts).where(eq(posts.id, id));
  // 清理向量行，避免孤儿数据（embedding 未配置时是无害的空删）
  try {
    const { deleteEmbeddings } = await import("@/lib/rag");
    await deleteEmbeddings("post", id);
  } catch {}
  revalidateAll();
}

export async function togglePostPin(id: number) {
  await guard();
  const row = (await db.select().from(posts).where(eq(posts.id, id)).limit(1))[0];
  if (!row) return;
  await db.update(posts).set({ isPinned: !row.isPinned }).where(eq(posts.id, id));
  revalidateAll();
}

export async function setPostStatus(id: number, status: "draft" | "published") {
  await guard();
  await db
    .update(posts)
    .set({
      status,
      publishedAt: status === "published" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));
  revalidateAll();
}

/* ============ 分类 / 标签 ============ */

export async function saveCategory(input: { id?: number; name: string; color?: string }) {
  await guard();
  const name = input.name.trim();
  if (!name) return { error: "名称不能为空" };
  const values = { name, slug: slugify(name), color: input.color || "#6366f1" };
  if (input.id) {
    await db.update(categories).set(values).where(eq(categories.id, input.id));
  } else {
    await db.insert(categories).values(values).onConflictDoNothing();
  }
  revalidateAll();
  return { ok: true as const };
}

export async function deleteCategory(id: number) {
  await guard();
  await db.delete(categories).where(eq(categories.id, id));
  revalidateAll();
}

export async function createTag(name: string) {
  await guard();
  const trimmed = name.trim();
  if (!trimmed) return { error: "名称不能为空" };
  await db.insert(tags).values({ name: trimmed, slug: slugify(trimmed) }).onConflictDoNothing();
  revalidateAll();
  return { ok: true as const };
}

export async function deleteTag(id: number) {
  await guard();
  await db.delete(tags).where(eq(tags.id, id));
  revalidateAll();
}

/* ============ 说说 ============ */

export async function saveMoment(input: {
  id?: number;
  content: string;
  images: string[];
  mood?: string;
  location?: string;
}) {
  await guard();
  if (!input.content.trim()) return { error: "内容不能为空" };
  const values = {
    content: input.content.trim(),
    images: JSON.stringify(input.images),
    mood: input.mood ?? "",
    location: input.location ?? "",
  };
  let momentId = input.id;
  if (input.id) {
    await db.update(moments).set(values).where(eq(moments.id, input.id));
  } else {
    momentId = (await db.insert(moments).values(values).returning())[0]!.id;
  }
  revalidateAll();
  // 说说也参与 RAG 检索，保存后自动更新向量（未配置 embedding 时为空操作，不影响保存）
  if (momentId) {
    try {
      const { rebuildMomentEmbeddings } = await import("@/lib/rag");
      void rebuildMomentEmbeddings(momentId).catch(() => {});
    } catch {}
  }
  return { ok: true as const };
}

export async function deleteMoment(id: number) {
  await guard();
  await db.delete(moments).where(eq(moments.id, id));
  try {
    const { deleteEmbeddings } = await import("@/lib/rag");
    await deleteEmbeddings("moment", id);
  } catch {}
  revalidateAll();
}

/* ============ 友链 ============ */

export async function saveFriend(input: {
  id?: number;
  name: string;
  url: string;
  avatar: string;
  description: string;
  sort: number;
}) {
  await guard();
  if (!input.name.trim() || !input.url.trim()) return { error: "名称与链接不能为空" };
  const values = {
    name: input.name.trim(),
    url: input.url.trim(),
    avatar: input.avatar ?? "",
    description: input.description ?? "",
    sort: input.sort || 0,
  };
  if (input.id) {
    await db.update(friendLinks).set(values).where(eq(friendLinks.id, input.id));
  } else {
    await db.insert(friendLinks).values(values);
  }
  revalidateAll();
  return { ok: true as const };
}

export async function deleteFriend(id: number) {
  await guard();
  await db.delete(friendLinks).where(eq(friendLinks.id, id));
  revalidateAll();
}

/* ============ 相册 ============ */

export async function saveAlbum(input: { id?: number; title: string; description: string; cover: string }) {
  await guard();
  if (!input.title.trim()) return { error: "标题不能为空" };
  const values = {
    title: input.title.trim(),
    description: input.description ?? "",
    cover: input.cover ?? "",
  };
  if (input.id) {
    await db.update(albums).set(values).where(eq(albums.id, input.id));
  } else {
    await db.insert(albums).values(values);
  }
  revalidateAll();
  return { ok: true as const };
}

export async function deleteAlbum(id: number) {
  await guard();
  await db.delete(albums).where(eq(albums.id, id));
  revalidateAll();
}

export async function addPhotos(albumId: number, urls: string[], caption = "") {
  await guard();
  if (!urls.length) return { error: "没有图片" };
  const maxSort = (
    await db.select({ sort: photos.sort }).from(photos).where(eq(photos.albumId, albumId))
  ).reduce((m, r) => Math.max(m, r.sort), 0);
  await db.insert(photos).values(
    urls.map((url, i) => ({ albumId, url, caption, sort: maxSort + i + 1 })),
  );
  revalidateAll();
  return { ok: true as const };
}

export async function updatePhotoCaption(id: number, caption: string) {
  await guard();
  await db.update(photos).set({ caption }).where(eq(photos.id, id));
  revalidateAll();
}

export async function deletePhoto(id: number) {
  await guard();
  await db.delete(photos).where(eq(photos.id, id));
  revalidateAll();
}

/* ============ 音乐馆 ============ */

export async function savePlaylist(input: {
  id?: number;
  title: string;
  description: string;
  cover: string;
}) {
  await guard();
  if (!input.title.trim()) return { error: "标题不能为空" };
  const values = { title: input.title.trim(), description: input.description ?? "", cover: input.cover ?? "" };
  if (input.id) {
    await db.update(playlists).set(values).where(eq(playlists.id, input.id));
  } else {
    await db.insert(playlists).values(values);
  }
  revalidateAll();
  return { ok: true as const };
}

export async function deletePlaylist(id: number) {
  await guard();
  await db.delete(playlists).where(eq(playlists.id, id));
  revalidateAll();
}

export async function saveSong(input: {
  id?: number;
  playlistId: number;
  title: string;
  artist: string;
  cover: string;
  url: string;
  lrc: string;
  duration?: number;
}) {
  await guard();
  if (!input.title.trim() || !input.url.trim()) return { error: "歌名与音频地址不能为空" };
  const values = {
    playlistId: input.playlistId,
    title: input.title.trim(),
    artist: input.artist ?? "",
    cover: input.cover ?? "",
    url: input.url.trim(),
    lrc: input.lrc ?? "",
    duration: input.duration ?? 0,
  };
  if (input.id) {
    await db.update(songs).set(values).where(eq(songs.id, input.id));
  } else {
    const maxSort = (await db.select({ sort: songs.sort }).from(songs).where(eq(songs.playlistId, input.playlistId))).reduce((m, r) => Math.max(m, r.sort), 0);
    await db.insert(songs).values({ ...values, sort: maxSort + 1 });
  }
  revalidateAll();
  return { ok: true as const };
}

export async function deleteSong(id: number) {
  await guard();
  await db.delete(songs).where(eq(songs.id, id));
  revalidateAll();
}

/* ============ 网易云歌单导入 ============ */

const NETEASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
  Referer: "https://music.163.com/",
};

/** 曲目详情单批上限：一次塞太多 id，表单 body 过大会被网易云拒 */
const DETAIL_BATCH = 200;
/** 总量上限，防超大歌单把 server action 拖到超时 */
const MAX_TRACKS = 500;

/** 图片转 https：网易云给的封面多是 http://，https 站点下会被判混合内容拦掉 */
function toHttps(url: string | undefined | null): string {
  return (url ?? "").replace(/^http:\/\//, "https://");
}

/** 从输入里取歌单 ID：支持完整分享链接（含 /#/playlist?id=）与纯数字 */
function parsePlaylistId(input: string): string | null {
  const s = input.trim();
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/[?&]id=(\d+)/);
  return m ? m[1] : null;
}

/**
 * 网易云歌单导入：音频走官方外链（非 VIP 可直接播放）。
 *
 * 分两步拉取 —— 歌单详情接口的 tracks 只返回前 10 首完整对象（trackCount 也可能
 * 谎报成 10），只有 trackIds 是全的，必须再用 song/detail 批量补齐，否则会静默少导。
 */
export async function importNetease(playlistId: string) {
  await guard();
  const pid = parsePlaylistId(playlistId);
  if (!pid) return { error: "请输入网易云歌单链接或数字 ID" };

  try {
    // ① 歌单元信息 + 全部曲目 ID
    const plRes = await fetch(
      `https://music.163.com/api/v6/playlist/detail?id=${pid}&n=1000`,
      { headers: NETEASE_HEADERS, signal: AbortSignal.timeout(15000) },
    );
    if (!plRes.ok) return { error: `网易云歌单接口请求失败（HTTP ${plRes.status}）` };

    const plData = (await plRes.json()) as {
      code?: number;
      msg?: string;
      playlist?: {
        name?: string;
        coverImgUrl?: string;
        trackCount?: number;
        trackIds?: Array<{ id: number }>;
      };
    };
    if (plData.code !== 200) {
      return {
        error: `网易云返回错误码 ${plData.code ?? "未知"}${plData.msg ? `：${plData.msg}` : ""}（歌单可能不存在或为私密）`,
      };
    }
    const pl = plData.playlist;
    if (!pl) return { error: "网易云未返回歌单数据（接口结构可能已变化）" };

    const ids = (pl.trackIds ?? []).map((t) => t.id).filter((id) => Number.isFinite(id));
    if (!ids.length) return { error: `歌单「${pl.name ?? pid}」里没有歌曲` };

    const wanted = ids.slice(0, MAX_TRACKS);

    // ② 分批补齐曲目详情（返回顺序不保证，用 Map 按 trackIds 原序回填）
    const detailMap = new Map<
      number,
      { name?: string; ar?: Array<{ name?: string }>; al?: { picUrl?: string }; dt?: number }
    >();
    for (let i = 0; i < wanted.length; i += DETAIL_BATCH) {
      const batch = wanted.slice(i, i + DETAIL_BATCH);
      const body = new URLSearchParams({
        c: JSON.stringify(batch.map((id) => ({ id }))),
      });
      const dRes = await fetch("https://music.163.com/api/v3/song/detail", {
        method: "POST",
        headers: { ...NETEASE_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (!dRes.ok) return { error: `曲目详情接口请求失败（HTTP ${dRes.status}）` };
      const dData = (await dRes.json()) as {
        code?: number;
        songs?: Array<{
          id: number;
          name?: string;
          ar?: Array<{ name?: string }>;
          al?: { picUrl?: string };
          dt?: number;
        }>;
      };
      for (const s of dData.songs ?? []) detailMap.set(s.id, s);
    }
    if (!detailMap.size) {
      return { error: `拿到 ${wanted.length} 个曲目 ID，但详情接口未返回任何曲目` };
    }

    const rows = wanted
      .map((id) => ({ id, d: detailMap.get(id) }))
      .filter((x): x is { id: number; d: NonNullable<typeof x.d> } => !!x.d)
      .map(({ id, d }, i) => ({
        title: d.name ?? `未知曲目 ${id}`,
        artist: (d.ar ?? []).map((a) => a.name).filter(Boolean).join(" / "),
        cover: toHttps(d.al?.picUrl),
        url: `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
        duration: Math.round((d.dt ?? 0) / 1000),
        sort: i + 1,
      }));

    // ③ 按来源 upsert：同一歌单重复导入则覆盖，不堆同名歌单
    const sourceId = `netease:${pid}`;
    const meta = {
      title: pl.name || `网易云歌单 ${pid}`,
      description: `从网易云导入（${rows.length} 首）`,
      cover: toHttps(pl.coverImgUrl),
      sourceId,
    };

    const [existing] = await db
      .select({ id: playlists.id })
      .from(playlists)
      .where(eq(playlists.sourceId, sourceId))
      .limit(1);

    let targetId: number;
    let updated = false;
    if (existing) {
      await db.update(playlists).set(meta).where(eq(playlists.id, existing.id));
      await db.delete(songs).where(eq(songs.playlistId, existing.id));
      targetId = existing.id;
      updated = true;
    } else {
      const [row] = await db.insert(playlists).values(meta).returning();
      targetId = row.id;
    }

    await db.insert(songs).values(rows.map((r) => ({ ...r, playlistId: targetId })));

    revalidateAll();
    return {
      ok: true as const,
      count: rows.length,
      updated,
      title: meta.title,
      // trackCount 与实际拿到的数目不一致时（个别曲目已下架）告知，避免"少了几首"的困惑
      missing: wanted.length - rows.length,
    };
  } catch (e) {
    return { error: e instanceof Error ? `导入失败：${e.message}` : "导入失败" };
  }
}

/**
 * 为缺摘要（description 为空）的文章批量生成 AI 摘要。
 * 每次最多处理 5 篇——LLM 单篇数秒，批太多会顶到 server action 超时；
 * 返回 remaining 让 UI 提示"继续点击"直到清零。
 */
export async function backfillSummariesAction() {
  await guard();
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
    const r = await summarizeContent(row.title, row.content);
    if (r.ok) {
      await db
        .update(posts)
        .set({ description: r.summary, updatedAt: new Date() })
        .where(eq(posts.id, row.id));
      updated++;
    } else {
      lastError = r.error;
    }
  }

  const remainingRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.description, ""));
  const remaining = remainingRows[0]?.n ?? 0;

  if (updated === 0) {
    return { error: lastError || "没有需要补摘要的文章" };
  }
  revalidateAll();
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

/**
 * 为没有任何标签的文章批量补 AI 标签（每批 5 篇防 action 超时）。
 * 只补空——已有标签的文章绝不修改；模型优先复用标签库现有词，
 * 新词按 savePost 同款逻辑（slug 查重）建入 tags 表，与标签管理页天然联动。
 */
export async function backfillTagsAction() {
  await guard();
  if (!(await llmConfigured())) {
    return { error: "未配置 AI（DEEPSEEK_API_KEY / GLM_API_KEY / QWEN_API_KEY 任意一家），请在 .env 中设置后重启服务" };
  }
  const existingNames = (
    await db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name))
  ).map((t) => t.name);

  const rows = await db
    .select({ id: posts.id, title: posts.title, content: posts.content })
    .from(posts)
    .where(sql`NOT EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = posts.id)`)
    .orderBy(asc(posts.id))
    .limit(5);

  let updated = 0;
  let lastError = "";
  for (const row of rows) {
    const r = await suggestTags(row.title, row.content, existingNames);
    if (!r.ok) {
      lastError = r.error;
      continue;
    }
    for (const name of r.tags) {
      const tslug = slugify(name);
      let tagRow = (await db.select().from(tags).where(eq(tags.slug, tslug)).limit(1))[0];
      if (!tagRow) {
        tagRow = (await db.insert(tags).values({ name, slug: tslug }).returning())[0]!;
        existingNames.push(name); // 后续文章的"现有标签列表"带上本轮新建的词
      }
      await db.insert(postTags).values({ postId: row.id, tagId: tagRow.id }).onConflictDoNothing();
    }
    updated++;
  }

  const remainingRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(posts)
    .where(sql`NOT EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = posts.id)`);
  const remaining = remainingRows[0]?.n ?? 0;

  if (updated === 0) {
    return { error: lastError || "没有需要补标签的文章" };
  }
  revalidateAll();
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

/* ============ 站点配置 ============ */

/** 重建全部文章与说说的 RAG 向量索引（后台按钮） */
export async function rebuildEmbeddingsAction() {
  await guard();
  const { rebuildPostEmbeddings, rebuildMomentEmbeddings, embeddingConfigured } = await import(
    "@/lib/rag"
  );
  if (!embeddingConfigured()) {
    return { error: "未配置 EMBEDDING_API_KEY（当前问答走关键词检索，功能可用但语义匹配较弱）" };
  }
  try {
    const r = await rebuildPostEmbeddings();
    if (!("ok" in r)) return { error: r.error };
    const m = await rebuildMomentEmbeddings();
    if (!("ok" in m)) return { error: m.error };
    return {
      ok: true as const,
      message: `已为 ${r.posts} 篇文章、${m.moments} 条说说生成 ${r.chunks + m.chunks} 个向量块`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "重建失败" };
  }
}

export async function saveSettings(config: SiteConfig) {
  await guard();
  await saveSiteConfig(config);
  revalidateAll();
  return { ok: true as const };
}

/* ============ AI 对话管理（/admin/ai-chat） ============ */

const AI_PROVIDERS = new Set(["deepseek", "glm", "qwen"]);

/** 保存模型预设与每访客限额：只合并进 aiChat 字段，其余站点设置不受影响 */
export async function saveAiChat(input: AiChatConfig) {
  await guard();
  // 服务端清洗：客户端表单不可信
  const choices = (Array.isArray(input.choices) ? input.choices : [])
    .slice(0, 6)
    .map((c) => ({
      id: String(c.id ?? "").trim().slice(0, 64),
      label: String(c.label ?? "").trim().slice(0, 24),
      provider: (AI_PROVIDERS.has(c.provider) ? c.provider : "deepseek") as AiChatConfig["choices"][number]["provider"],
      model: typeof c.model === "string" && c.model.trim() ? c.model.trim().slice(0, 64) : undefined,
      thinking: c.thinking === true,
    }))
    .filter((c) => c.id && c.label);
  // id 去重（重复的丢弃）
  const seen = new Set<string>();
  const unique = choices.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  if (!unique.length) return { error: "至少保留一个有效的模型预设" };
  const defaultChoice = unique.some((c) => c.id === input.defaultChoice)
    ? input.defaultChoice
    : unique[0]!.id;
  const clamp = (n: unknown) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), 0), 999) : 0;
  };
  const current = await getSiteConfig();
  await saveSiteConfig({
    ...current,
    aiChat: {
      choices: unique,
      defaultChoice,
      allowVisitorChoice: input.allowVisitorChoice === true,
      perVisitorHourly: clamp(input.perVisitorHourly),
      perVisitorDaily: clamp(input.perVisitorDaily),
    },
  });
  revalidateAll();
  return { ok: true as const };
}

/* ============ 批量删除（辅助） ============ */

export async function deletePostsByIds(ids: number[]) {
  await guard();
  if (ids.length) {
    await db.delete(postTags).where(inArray(postTags.postId, ids));
    await db.delete(posts).where(inArray(posts.id, ids));
    revalidateAll();
  }
}

export async function ensureAdminExists(username: string, password: string) {
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  if (!existing.length) {
    await db.insert(adminUsers).values({
      username,
      passwordHash: await bcrypt.hash(password, 10),
    });
  }
}
