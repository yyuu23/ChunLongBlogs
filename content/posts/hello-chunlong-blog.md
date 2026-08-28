---
title: 你好，ChunLong Blog 上线啦
slug: hello-chunlong-blog
description: 为什么我要写博客，以及这个小站是怎么搭起来的——Next.js 全栈 + 毛玻璃 + 粒子动效。
cover: /assets/covers/cover-1.svg
category: tech
tags: [随想, Next.js]
date: 2026-08-20
pinned: true
---

欢迎来到我的小站 🎉

这里会记录我的技术笔记、踩坑经验和一些生活随想。网站本身也是一件"作品"：它用 **Next.js 全栈** 构建，前后台一体，数据存在一个小小的 SQLite 文件里。

## 为什么自己写博客

> 把"想做"变成"做完"，是博客存在的意义。

- 输出倒逼输入，写出来才算真的懂了
- 有一个完全属于自己的角落，不受平台规则约束
- 折腾本身就是乐趣

## 这个站有什么

| 模块 | 说明 |
| --- | --- |
| 公开站点 | 首页 / 文章 / 归档 / 说说 / 相册 / 友链 |
| 动效 | 毛玻璃、樱花与萤火虫粒子、点击爆破、页面过渡 |
| 后台 | `/admin` 在线写作，Markdown 实时预览 |

> [!NOTE]
> 暗色模式下会切换成萤火虫粒子，亮色模式是樱花，试试右上角的主题按钮 ✨

## 一点代码

文章就是这样渲染出来的——服务端 Markdown 管线：

```ts
const html = await unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypePrettyCode) // Shiki 代码高亮
  .process(markdown);
```

部署也很简单：

```bash
npm run build
pm2 start npm --name chunlong-blog -- start
```

> [!TIP]
> 本站代码开源于 [GitHub](https://github.com/yyuu23/ChunLongBlogs)，欢迎参考。

那么，开始写吧。
