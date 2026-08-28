// 数据库种子：node/tsx 运行 scripts/seed.ts（幂等：先清空再写入）
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import matter from "gray-matter";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";
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
  siteConfigs,
  tags,
} from "../src/lib/db/schema";
import { countWords, readingTimeMinutes, excerpt, slugify } from "../src/lib/utils";
import { DEFAULT_SITE_CONFIG, saveSiteConfig } from "../src/lib/site";

if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)?\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  console.log("seeding...");

  // —— 清空（保留表结构）——
  await db.run(sql`PRAGMA foreign_keys = OFF`);
  for (const t of [
    "songs",
    "playlists",
    "post_tags",
    "photos",
    "albums",
    "friend_links",
    "moments",
    "posts",
    "tags",
    "categories",
    "site_configs",
    "admin_users",
  ]) {
    await db.run(sql.raw(`DELETE FROM ${t}`));
  }
  await db.run(sql`PRAGMA foreign_keys = ON`);

  // —— 管理员 ——
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin1234";
  await db.insert(adminUsers).values({
    username,
    passwordHash: await bcrypt.hash(password, 10),
  });
  console.log(`admin user: ${username}`);

  // —— 分类 ——
  const cats = await db
    .insert(categories)
    .values([
      { name: "技术", slug: "tech", color: "#6366f1" },
      { name: "生活", slug: "life", color: "#10b981" },
      { name: "随笔", slug: "essay", color: "#f59e0b" },
    ])
    .returning();
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));

  // —— 文章（从 content/posts 读取）——
  const dir = path.join(process.cwd(), "content/posts");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const tagIds = new Map<string, number>();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const { data, content } = matter(raw);
    const slug = String(data.slug ?? slugify(String(data.title)));
    const date = data.date ? new Date(data.date) : new Date();
    const isDraft = Boolean(data.draft);

    const [post] = await db
      .insert(posts)
      .values({
        title: String(data.title),
        slug,
        description: String(data.description ?? excerpt(content, 100)),
        content,
        cover: String(data.cover ?? ""),
        categoryId: catBySlug.get(String(data.category ?? "tech")) ?? null,
        status: isDraft ? "draft" : "published",
        isPinned: Boolean(data.pinned),
        views: Math.floor(Math.random() * 400) + 40,
        wordCount: countWords(content),
        readingTime: readingTimeMinutes(content),
        createdAt: date,
        updatedAt: date,
        publishedAt: isDraft ? null : date,
      })
      .returning();

    const tagNames: string[] = Array.isArray(data.tags) ? data.tags.map(String) : [];
    for (const name of tagNames) {
      if (!tagIds.has(name)) {
        const [t] = await db
          .insert(tags)
          .values({ name, slug: slugify(name) })
          .onConflictDoNothing()
          .returning();
        if (t) tagIds.set(name, t.id);
        else {
          const existing = await db
            .select()
            .from(tags)
            .where(sql`${tags.name} = ${name}`)
            .limit(1);
          if (existing[0]) tagIds.set(name, existing[0].id);
        }
      }
      const tid = tagIds.get(name);
      if (tid) await db.insert(postTags).values({ postId: post.id, tagId: tid });
    }
  }
  console.log(`posts: ${files.length}`);

  // —— 说说 ——
  await db.insert(moments).values([
    {
      content: "博客上线第一天，看着满屏樱花差点忘了写文章 🌸",
      images: JSON.stringify(["/assets/photos/p1.svg", "/assets/photos/p2.svg"]),
      mood: "🎉",
      location: "家中",
      createdAt: new Date("2026-08-20T10:30:00"),
    },
    {
      content: "深夜调 CSS：改一行，看十分钟。但毛玻璃的光泽终于对味了。",
      images: "[]",
      mood: "🌙",
      location: "",
      createdAt: new Date("2026-08-24T01:12:00"),
    },
    {
      content: "傍晚的云像打翻的草莓牛奶，拍下来当下一张背景图。",
      images: JSON.stringify(["/assets/photos/p5.svg"]),
      mood: "🌤",
      location: "河边",
      createdAt: new Date("2026-08-27T18:45:00"),
    },
  ]);

  // —— 友链 ——
  await db.insert(friendLinks).values([
    {
      name: "Kirameku",
      url: "https://github.com/",
      avatar: "/assets/friends/f1.svg",
      description: "像星光一样闪耀的全栈博客",
      sort: 1,
    },
    {
      name: "萤火小站",
      url: "https://github.com/",
      avatar: "/assets/friends/f2.svg",
      description: "暗色模式与萤火虫粒子的实践者",
      sort: 2,
    },
    {
      name: "月下水榭",
      url: "https://github.com/",
      avatar: "/assets/friends/f3.svg",
      description: "写代码，也写生活",
      sort: 3,
    },
  ]);

  // —— 相册 ——
  const [album1, album2] = await db
    .insert(albums)
    .values([
      {
        title: "夏日剪影",
        description: "六月到八月的碎片",
        cover: "/assets/photos/p1.svg",
        createdAt: new Date("2026-08-20"),
      },
      {
        title: "屏幕之外",
        description: "一些走出房间的时刻",
        cover: "/assets/photos/p5.svg",
        createdAt: new Date("2026-08-26"),
      },
    ])
    .returning();

  const photoRows = [
    { albumId: album1.id, url: "/assets/photos/p1.svg", caption: "清晨", sort: 1 },
    { albumId: album1.id, url: "/assets/photos/p2.svg", caption: "午后", sort: 2 },
    { albumId: album1.id, url: "/assets/photos/p3.svg", caption: "黄昏", sort: 3 },
    { albumId: album1.id, url: "/assets/photos/p4.svg", caption: "夜色", sort: 4 },
    { albumId: album1.id, url: "/assets/photos/p7.svg", caption: "转角", sort: 5 },
    { albumId: album1.id, url: "/assets/photos/p8.svg", caption: "归途", sort: 6 },
    { albumId: album2.id, url: "/assets/photos/p5.svg", caption: "出发", sort: 1 },
    { albumId: album2.id, url: "/assets/photos/p6.svg", caption: "途中小憩", sort: 2 },
    { albumId: album2.id, url: "/assets/photos/p3.svg", caption: "侧光", sort: 3 },
    { albumId: album2.id, url: "/assets/photos/p1.svg", caption: "回望", sort: 4 },
  ];
  await db.insert(photos).values(photoRows);

  // —— 音乐馆（演示音频为脚本生成的免版权环境音）——
  const [demoPlaylist] = await db
    .insert(playlists)
    .values({
      title: "写作 BGM · 环境音",
      description: "内置演示音频（服务器生成），正式音乐请在后台上传或从网易云导入",
      cover: "/assets/bg/bg-3.svg",
    })
    .returning();
  await db.insert(songs).values([
    {
      playlistId: demoPlaylist.id,
      title: "晨光",
      artist: "ChunLong Blog",
      cover: "/assets/bg/bg-1.svg",
      url: "/music/morning-light.wav",
      duration: 20,
      sort: 1,
    },
    {
      playlistId: demoPlaylist.id,
      title: "漂浮",
      artist: "ChunLong Blog",
      cover: "/assets/bg/bg-2.svg",
      url: "/music/floating.wav",
      duration: 22,
      sort: 2,
    },
    {
      playlistId: demoPlaylist.id,
      title: "星尘",
      artist: "ChunLong Blog",
      cover: "/assets/bg/bg-4.svg",
      url: "/music/stardust.wav",
      duration: 24,
      sort: 3,
    },
  ]);

  // —— 站点配置 ——
  await saveSiteConfig(DEFAULT_SITE_CONFIG);

  console.log("done ✓");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
