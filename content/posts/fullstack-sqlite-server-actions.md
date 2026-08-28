---
title: 全栈一体：用 SQLite 和 Server Actions 做博客后台
slug: fullstack-sqlite-server-actions
description: 单人博客真的需要拆前后端吗？聊聊 Next.js 单体 + SQLite + Server Actions 的极简全栈实践。
cover: /assets/covers/cover-3.svg
category: tech
tags: [Next.js, SQLite, TypeScript]
date: 2026-08-27
pinned: false
---

传统思路里"全栈博客"意味着：前端一个仓库、后端一个仓库、数据库一个服务、管理后台又一个仓库。但一个人的博客，其实可以简单得多。

## 架构选型

我最终选了 **Next.js 单体**：

- 页面、API、后台、数据库全在一个应用里
- 数据库是 SQLite——一个文件，零运维，备份就是复制文件
- 表结构用 Drizzle ORM 定义，类型安全

```ts
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  status: text("status", { enum: ["draft", "published"] }).notNull(),
  views: integer("views").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
```

## Server Actions：没有 API 的"API"

写后台最爽的是 Server Actions——表单提交直接调用服务端函数，不用手写 fetch，也不用定义 REST 路由：

```ts
"use server";

export async function savePost(input: PostInput) {
  await requireAdmin(); // 会话校验
  await db.insert(posts).values(input);
  revalidatePath("/posts"); // 增量刷新
}
```

> [!TIP]
> Server Actions 天然和 `revalidatePath` 配合，保存文章后前台列表立即更新。

## 什么时候该拆？

> [!CAUTION]
> 以下情况再考虑加独立后端：多端共用数据、需要第三方高频写入、单库写入成为瓶颈。

单人博客的写入频率是"每天几次"，SQLite 的上限是每秒几十万次读取——完全不在一个量级上。

顺带一提，缓存策略也可以很朴素：动态页面直接 `force-dynamic`，配合 better-sqlite3 的同步读，页面渲染在个位数毫秒内完成。

## 数学也不在话下

KaTeX 渲染公式，比如圆的面积：

$$
A = \pi r^2
$$

以及质能方程 $E = mc^2$ 的行内效果。

## 结语

技术选型的第一原则是**匹配规模**。一个人的博客，一个进程 + 一个文件，就是最好的架构。
