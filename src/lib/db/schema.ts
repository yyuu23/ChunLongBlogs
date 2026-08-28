import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
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
  lastSeen: integer("last_seen", ts).notNull().default(sql`(unixepoch() * 1000)`),
});

/** 访客留声星：一句话化作天空中永久的星 */
export const stars = sqliteTable("stars", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  visitorId: text("visitor_id").notNull().default(""),
  createdAt: integer("created_at", ts).notNull().default(sql`(unixepoch() * 1000)`),
});
