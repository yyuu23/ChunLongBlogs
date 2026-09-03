import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  albums,
  categories,
  friendLinks,
  moments,
  photos,
  playlists,
  postTags,
  posts,
  siteConfigs,
  songs,
  tags,
} from "@/lib/db/schema";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 备份 JSON 的表行（宽松类型：手改过的文件什么都可能来） */
type Row = Record<string, unknown>;

const toDate = (v: unknown): Date | null => {
  if (v == null || v === "") return null; // posts.publishedAt 可空
  const d = new Date(v as string | number);
  return Number.isFinite(d.getTime()) ? d : new Date();
};
const reqDate = (v: unknown): Date => toDate(v) ?? new Date();
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** 备份里 moments.images 可能被手改坏，保底回 "[]" 防前台 JSON.parse 崩 */
const jsonArrayOfStrings = (v: unknown): string => {
  if (typeof v !== "string") return "[]";
  try {
    const parsed = JSON.parse(v) as unknown;
    return Array.isArray(parsed) ? v : "[]";
  } catch {
    return "[]";
  }
};

/**
 * 导入内容备份（POST JSON，走 route 而非 server action：action 请求体上限 1MB，
 * 含 markdown 正文的备份常态超标）。
 *
 * 合并策略：按主键 upsert，**从不清空**——同 id 的现有行被备份数据覆盖，
 * 本地新增内容保留，重复导入同一文件无副作用（幂等）。
 *
 * 事务说明：better-sqlite3 的事务是纯同步的（回调返回 promise 会直接抛
 * "Transaction function cannot return a promise" 并回滚，且 async 回调的余下
 * 代码会在回滚后继续裸跑——所以这里必须用 db.$client 的原生同步事务，
 * 内部全部走 drizzle 的同步 API（.all()/.run()），任何一行失败整体原子回滚。
 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const raw = await request.text();
  if (!raw) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
  if (raw.length > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "备份文件超过 50MB 上限" }, { status: 400 });
  }

  let data: { version?: unknown; tables?: Record<string, unknown>; siteConfig?: unknown };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return NextResponse.json({ error: "备份文件不是有效的 JSON" }, { status: 400 });
  }
  if (data.version !== 1 || typeof data.tables !== "object" || data.tables === null) {
    return NextResponse.json(
      { error: "备份格式不符（version 应为 1，缺少 tables 字段），请确认是本站导出的备份" },
      { status: 400 },
    );
  }

  const T = data.tables;
  const arr = (key: string): Row[] => {
    const v = T[key];
    return Array.isArray(v) ? (v as Row[]) : [];
  };

  const counts: Record<string, number> = {};
  const suffix = Date.now().toString(36).slice(-4); // 唯一冲突时追加的后缀（同一次导入共用）

  try {
    // 原生同步事务；回调内只用 drizzle 同步 API（.all()/.run()）
    db.$client.transaction(() => {
      /* ---------- ① categories（先于 posts：categoryId 外键） ---------- */
      const catSlugById = new Map(
        db.select({ id: categories.id, slug: categories.slug }).from(categories).all().map((r) => [r.id, r.slug]),
      );
      const catSlugTaken = new Set(catSlugById.values());
      counts.categories = 0;
      arr("categories").forEach((r, i) => {
        const id = num(r.id);
        let slug = str(r.slug);
        // 新行（id 本地不存在）的 slug 被别的 id 占用时改名，老行走 id 更新不受影响
        if (!catSlugById.has(id) && slug && catSlugTaken.has(slug)) slug = `${slug}-${suffix}`;
        const values = {
          id,
          name: str(r.name, "未命名"),
          slug,
          color: str(r.color, "#6366f1"),
          createdAt: reqDate(r.createdAt),
        };
        try {
          db.insert(categories).values(values).onConflictDoUpdate({ target: categories.id, set: values }).run();
        } catch (e) {
          throw new Error(`categories 表第 ${i + 1} 行：${(e as Error).message}`);
        }
        catSlugById.set(id, slug);
        catSlugTaken.add(slug);
        counts.categories++;
      });

      /* ---------- ② tags（name 与 slug 都唯一，都要查重） ---------- */
      const tagRows = db.select({ id: tags.id, name: tags.name, slug: tags.slug }).from(tags).all();
      const tagIdSet = new Set(tagRows.map((r) => r.id));
      const tagNameTaken = new Set(tagRows.map((r) => r.name));
      const tagSlugTaken = new Set(tagRows.map((r) => r.slug));
      counts.tags = 0;
      arr("tags").forEach((r, i) => {
        const id = num(r.id);
        let name = str(r.name, "未命名");
        let slug = str(r.slug, name);
        if (!tagIdSet.has(id)) {
          if (tagNameTaken.has(name)) name = `${name}-${suffix}`;
          if (tagSlugTaken.has(slug)) slug = `${slug}-${suffix}`;
        }
        const values = { id, name, slug };
        try {
          db.insert(tags).values(values).onConflictDoUpdate({ target: tags.id, set: values }).run();
        } catch (e) {
          throw new Error(`tags 表第 ${i + 1} 行：${(e as Error).message}`);
        }
        tagIdSet.add(id);
        tagNameTaken.add(name);
        tagSlugTaken.add(slug);
        counts.tags++;
      });

      /* ---------- ③ posts ---------- */
      const postSlugById = new Map(
        db.select({ id: posts.id, slug: posts.slug }).from(posts).all().map((r) => [r.id, r.slug]),
      );
      const postSlugTaken = new Set(postSlugById.values());
      counts.posts = 0;
      arr("posts").forEach((r, i) => {
        const id = num(r.id);
        let slug = str(r.slug);
        if (!postSlugById.has(id) && slug && postSlugTaken.has(slug)) slug = `${slug}-${suffix}`;
        const values = {
          id,
          title: str(r.title, "无标题"),
          slug,
          description: str(r.description),
          content: str(r.content),
          cover: str(r.cover),
          categoryId: r.categoryId == null ? null : num(r.categoryId),
          status: r.status === "published" ? ("published" as const) : ("draft" as const),
          isPinned: Boolean(r.isPinned),
          views: num(r.views),
          wordCount: num(r.wordCount),
          readingTime: Math.max(1, num(r.readingTime, 1)),
          createdAt: reqDate(r.createdAt),
          updatedAt: reqDate(r.updatedAt),
          publishedAt: toDate(r.publishedAt),
        };
        try {
          db.insert(posts).values(values).onConflictDoUpdate({ target: posts.id, set: values }).run();
        } catch (e) {
          throw new Error(`posts 表第 ${i + 1} 行：${(e as Error).message}`);
        }
        postSlugById.set(id, slug);
        postSlugTaken.add(slug);
        counts.posts++;
      });

      /* ---------- ④ postTags（复合主键链接表，冲突静默跳过） ---------- */
      counts.postTags = 0;
      arr("postTags").forEach((r, i) => {
        const values = { postId: num(r.postId), tagId: num(r.tagId) };
        try {
          db.insert(postTags).values(values).onConflictDoNothing().run();
        } catch (e) {
          throw new Error(`postTags 表第 ${i + 1} 行：${(e as Error).message}`);
        }
        counts.postTags++;
      });

      /* ---------- ⑤~⑩ 无唯一列的内容表（统一按 id upsert） ---------- */
      const simpleTables = [
        { name: "moments", table: moments, rows: arr("moments"), map: (r: Row) => ({
          id: num(r.id), content: str(r.content), images: jsonArrayOfStrings(r.images),
          mood: str(r.mood), location: str(r.location), createdAt: reqDate(r.createdAt),
        }) },
        { name: "friendLinks", table: friendLinks, rows: arr("friendLinks"), map: (r: Row) => ({
          id: num(r.id), name: str(r.name, "未命名"), url: str(r.url), avatar: str(r.avatar),
          description: str(r.description), sort: num(r.sort), createdAt: reqDate(r.createdAt),
        }) },
        { name: "albums", table: albums, rows: arr("albums"), map: (r: Row) => ({
          id: num(r.id), title: str(r.title, "未命名相册"), description: str(r.description),
          cover: str(r.cover), createdAt: reqDate(r.createdAt),
        }) },
        { name: "photos", table: photos, rows: arr("photos"), map: (r: Row) => ({
          id: num(r.id), albumId: num(r.albumId), url: str(r.url), caption: str(r.caption), sort: num(r.sort),
        }) },
        { name: "playlists", table: playlists, rows: arr("playlists"), map: (r: Row) => ({
          id: num(r.id), title: str(r.title, "未命名歌单"), description: str(r.description),
          cover: str(r.cover), createdAt: reqDate(r.createdAt),
        }) },
        { name: "songs", table: songs, rows: arr("songs"), map: (r: Row) => ({
          id: num(r.id), playlistId: num(r.playlistId), title: str(r.title, "未命名"), artist: str(r.artist),
          cover: str(r.cover), url: str(r.url), lrc: str(r.lrc), duration: num(r.duration), sort: num(r.sort),
        }) },
      ] as const;

      for (const { name, table, rows, map } of simpleTables) {
        counts[name] = 0;
        rows.forEach((r, i) => {
          const values = map(r);
          try {
            db.insert(table).values(values).onConflictDoUpdate({ target: table.id, set: values }).run();
          } catch (e) {
            throw new Error(`${name} 表第 ${i + 1} 行：${(e as Error).message}`);
          }
          counts[name]++;
        });
      }

      /* ---------- ⑪ 站点配置（单行 JSON） ---------- */
      if (data.siteConfig && typeof data.siteConfig === "object") {
        const value = JSON.stringify(data.siteConfig);
        db.insert(siteConfigs)
          .values({ key: "site", value, updatedAt: new Date() })
          .onConflictDoUpdate({ target: siteConfigs.key, set: { value, updatedAt: new Date() } })
          .run();
        counts.siteConfig = 1;
      }
    })();
  } catch (e) {
    return NextResponse.json(
      {
        error: `导入失败（已回滚，数据库未做任何改动）——${e instanceof Error ? e.message : "未知错误"}`,
      },
      { status: 400 },
    );
  }

  revalidatePath("/", "layout");
  return NextResponse.json({
    ok: true as const,
    counts,
    hint: "如已配置向量检索，建议到设置页点一次「重建全部文章向量」刷新 RAG 索引",
  });
}
