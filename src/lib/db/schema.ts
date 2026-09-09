import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const ts = { withTimezone: false, mode: "timestamp_ms" } as const;

export const adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  content: text("content").notNull().default(""),
  cover: text("cover").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  views: integer("views").notNull().default(0),
  wordCount: integer("word_count").notNull().default(0),
  readingTime: integer("reading_time").notNull().default(1),
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
  publishedAt: integer("published_at", ts),
});

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const moments = sqliteTable("moments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  images: text("images").notNull().default("[]"), // JSON: string[]
  mood: text("mood").notNull().default(""), // emoji
  location: text("location").notNull().default(""),
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

export const friendLinks = sqliteTable("friend_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  avatar: text("avatar").notNull().default(""),
  description: text("description").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

export const albums = sqliteTable("albums", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  cover: text("cover").notNull().default(""),
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  albumId: integer("album_id")
    .notNull()
    .references(() => albums.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption").notNull().default(""),
  sort: integer("sort").notNull().default(0),
});

export const siteConfigs = sqliteTable("site_configs", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updatedAt: integer("updated_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

export const playlists = sqliteTable("playlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  cover: text("cover").notNull().default(""),
  /** 导入来源标识（如 "netease:18350188579"）：同一歌单重复导入时覆盖更新而非堆同名歌单。
   * 手工新建的歌单为 null */
  sourceId: text("source_id"),
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

export const songs = sqliteTable("songs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playlistId: integer("playlist_id")
    .notNull()
    .references(() => playlists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  artist: text("artist").notNull().default(""),
  cover: text("cover").notNull().default(""),
  url: text("url").notNull().default(""), // 本地路径/直链/网易云外链
  lrc: text("lrc").notNull().default(""),
  duration: integer("duration").notNull().default(0), // 秒
  sort: integer("sort").notNull().default(0),
});

/** RAG 向量索引（文章切块的嵌入，JSON 存 SQLite，无需独立向量库） */
export const embeddings = sqliteTable("embeddings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  refType: text("ref_type").notNull().default("post"),
  refId: integer("ref_id").notNull(),
  chunk: text("chunk").notNull(),
  vector: text("vector").notNull(), // JSON number[]
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

/** 匿名访客的游戏化进度（等级/经验/统计），服务端永久保存 */
export const visitors = sqliteTable("visitors", {
  id: text("id").primaryKey(), // 匿名 UUID（localStorage 生成）
  xp: integer("xp").notNull().default(0),
  stats: text("stats").notNull().default("{}"), // JSON：各类行为计数
  // AI 积分余额（可消耗货币）：每日首访/签到发放，对话按 模型基准价×档位倍率 扣减。
  // 独立列而非塞进 stats JSON——扣减需要 SQL 级原子操作（credits >= cost 才减），
  // JSON 整包读改写在并发请求下会丢更新。
  credits: integer("credits").notNull().default(0),
  lastSeen: integer("last_seen", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

/** 访客留声星：一句话化作天空中永久的星 */
export const stars = sqliteTable("stars", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  visitorId: text("visitor_id").notNull().default(""),
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
  /* 站长精选：前台小行星带渲染为更大的白金亮星 */
  featured: integer("featured").notNull().default(0),
  /* 软删除时间戳：公开 API 与前台过滤，admin 可恢复 */
  deletedAt: integer("deleted_at", ts),
});

/**
 * 访客漂流瓶：留星 / 成就 / 节气节日 / 跨年 的封存纪念（实验室瓶子架展示）。
 * theme 记录"获得当时的粒子季节"，瓶里永远封着那一天的风景。
 * (visitorId, kind, refKey) 唯一 —— 同一来源幂等，不重复发瓶。
 * openedAt：开瓶仪式时间（不可逆；开过瓶液体剩四成、节气信笺可读）。
 */
export const bottles = sqliteTable(
  "bottles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    visitorId: text("visitor_id").notNull(),
    kind: text("kind").notNull(), // star | achievement | festival | newyear
    refKey: text("ref_key").notNull().default(""), // 留星=starId、成就=key、节日=festival key、跨年=年份
    title: text("title").notNull().default(""), // 留星内容摘录（展示快照）
    theme: text("theme").notNull().default("sakura"), // sakura | firefly | leaf | snow
    createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
    openedAt: integer("opened_at", ts),
  },
  (t) => [uniqueIndex("bottles_visitor_kind_ref_idx").on(t.visitorId, t.kind, t.refKey)],
);

/**
 * 留声星「回一束光」：看星人对公共留声星的一次致意。
 * unique(starId, visitorId) —— 同一访客对同一颗星天然只能回一次光；
 * 星主侧的「有 N 人回过光」即按 starId 计数。
 */
export const starLights = sqliteTable(
  "star_lights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    starId: integer("star_id")
      .notNull()
      .references(() => stars.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("star_lights_star_visitor_idx").on(t.starId, t.visitorId)],
);

/**
 * 按天聚合的行为计数（admin 数据统计面板）。
 * 不存原始事件流水——每次事件只 UPSERT +1，一年约 1.8 万行 < 1MB。
 * metric：pv（key=路径）| ai_call（key=供应商|模型|档位）| ai_tool（key=工具名）
 *         | ai_image（key=张数）| music_play（key=歌名）
 */
export const statsDaily = sqliteTable(
  "stats_daily",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    day: text("day").notNull(), // 本地时区 YYYY-MM-DD
    metric: text("metric").notNull(),
    key: text("key").notNull().default(""),
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("stats_daily_day_metric_key_idx").on(t.day, t.metric, t.key)],
);

/** 每日独立访客（day+visitorId 唯一 → UV 精确去重；一年约 1-2MB） */
export const visitorDays = sqliteTable(
  "visitor_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    day: text("day").notNull(),
    visitorId: text("visitor_id").notNull(),
  },
  (t) => [uniqueIndex("visitor_days_day_vid_idx").on(t.day, t.visitorId)],
);
