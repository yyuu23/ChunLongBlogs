---
title: 从 giscus 到自建评论和点赞
slug: native-comments-story
description: 把评论区从 giscus 搬回自己手里的全过程：多态评论表、GitHub OAuth 双会话、游客点赞回填，以及为什么要自找这个麻烦。
category: tech
tags: [全栈, OAuth]
date: 2026-09-06
---

这个博客的评论区曾经是 [giscus](https://giscus.app)——基于 GitHub Discussions 的开源评论组件，一段 script 标签就能用。但用了一阵之后，我把它拆了，自己写了一套。这篇文章记录为什么拆，以及拆的过程中那些值得记下的设计。

## 为什么要拆掉 giscus

giscus 的问题不在它本身，而在于"借来的东西不合身"：

- 评论数据在 GitHub Discussions 里，我的数据库完全不认识它们——**站内搜索搜不到评论**，后台也没法管理（删广告评论要去 GitHub 操作）；
- 访客必须登录 GitHub 才能评论。对技术博客这似乎合理，但我的访客里还有不少朋友是非技术背景的；
- 外挂 script 和站内的毛玻璃、动效体系永远隔着一层，视觉上是"贴上去的"而不是"长出来的"。

我想要的其实是一套**原生的、访客友好的、数据归我自己的**互动系统。

## 多态评论表：文章和说说共用一套

设计评论表时最自然的想法是分两张表（文章评论、说说评论），但那样后台管理、渲染组件、API 都要双份。最后用了多态设计：

```ts
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  refType: text("ref_type").notNull(),   // "post" | "moment"
  refId: integer("ref_id").notNull(),    // 文章 id 或说说 id
  visitorId: text("visitor_id"),          // 游客身份
  githubUserId: integer("github_user_id"), // 登录身份（二选一）
  content: text("content").notNull(),
  parentId: integer("parent_id"),         // 一层回复
  deletedAt: integer("deleted_at"),       // 软删除
  createdAt: integer("created_at").notNull(),
});
```

`refType + refId` 指向被评论的对象，文章和说说共用同一张表、同一个 API、同一个渲染组件。软删除（`deletedAt`）代替物理删除——楼层引用不至于因为删一条评论而错乱。

> [!NOTE]
> 回复只做了一层（`parentId` 指向根评论）。博客场景里多级嵌套的阅读体验通常不如"平铺 + @提及"，这是我刻意的选择。

## 身份：匿名也能说话，登录获得头像

身份系统是双轨的：

- **游客**：浏览器 localStorage 里一个匿名 UUID，可以直接评论和点赞，零门槛；
- **GitHub 登录**：点一下授权，回来就有了头像和昵称。

OAuth 的实现坚持了一条安全底线：**client secret 永远不出服务器**。浏览器只被重定向到 GitHub 授权页，回调落到我自己的服务端路由，code 换 token 的请求在服务器内部完成，带着 `state` 防 CSRF。整个流程四条路由：发起、回调、登出、查我。

会话是 httpOnly 的 JWT cookie，和管理员的会话分开签发。`github_users` 表只存公开资料（login、头像、bio），不存 token。

## 最微妙的一笔：游客点赞回填

上线前的某个深夜我意识到一个问题：一个访客先用游客身份给三篇文章点了赞，后来一时兴起登录了 GitHub——**那三个赞还是匿名的**，头像列表里没有他。

于是我做了回填：登录成功的瞬间，服务端把这个游客 UUID 名下的所有点赞和评论，原子地迁移到 GitHub 身份下。用户什么都不用做，点过的赞"跟人走"了。

```sql
UPDATE post_likes SET github_user_id = ? WHERE visitor_id = ?;
```

> [!TIP]
> 匿名到实名的身份合并是所有"低门槛 + 可登录"双轨系统的必修课。上线时不想清楚，日后数据洗起来会哭。

## 后台：管理也是产品的一部分

评论管理进了后台：按文章聚合、审核、软删除、恢复，外加一份点赞/评论的统计榜单（哪篇文章被赞得最多、哪条说说评论最热）。这份榜单意外地成了我写作的反馈回路——数据告诉我大家在看什么。

## 复盘

拆掉 giscus 换来的是三样东西：数据主权（评论进 SQLite，搜索、备份、迁移一体）、体验一致（评论框也是毛玻璃卡片）、玩法自由（点赞可以做成头像朋友圈列表，giscus 给不了）。

成本是两周的全栈开发和一直要背的安全责任。但如果重来一次，我还是会拆——**博客的乐趣一半在写，另一半在造**。
