# ChunLong Blog

一个 Next.js 全栈个人博客：毛玻璃视觉 + 主题粒子动效 + 内置完整管理后台。

## 特性

- **公开站点**
  - 首页：Banner 轮播、资料卡、节气公告、天气卡、最新文章、相册海报卡
  - 文章：双视图 / 分类标签筛选 / 分页 + 阅读进度条；详情：Shiki 高亮、KaTeX、提示框、目录、giscus 评论、阅读量
  - 归档时间线、说说、相册（拍立得照片墙 + 灯箱）、友链、关于、RSS、站内搜索、sitemap
  - **音乐馆** + 底部全局播放器（跨页不断播、网易云歌单导入、最近播放）
  - **实验室** `/lab`：three.js 星海 + 可交互发光晶体
- **华丽体验**：五套主题色全站换装（代码块配色跟随）、亮樱/暗萤/落叶/落雪粒子（含季节自动档）、点击爆破、文字选中星光、Logo 七连击彩蛋、开场启动屏、页面过渡、滚动渐入、3D 倾斜卡片、导航日历、移动端底部 Tab、**Live2D 看板娘 + AI 聊天助手**
- **管理后台 `/admin`**：Markdown 编辑器实时预览、文章 / 分类标签 / 说说 / 友链 / 相册 / **音乐** / 站点配置全管理

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · framer-motion · SQLite + Drizzle ORM · jose JWT · unified/remark/rehype + Shiki · three.js · pixi.js + Live2D · giscus

## 快速开始

```bash
npm install
cp .env.example .env        # 修改管理员密码与 AUTH_SECRET
npm run db:push             # 建表
npm run db:seed             # 种子数据（演示文章/友链/相册/站点配置）
npm run dev                 # http://localhost:3000
```

后台入口 `http://localhost:3000/admin`，账号密码见 `.env`。

## 部署

见 [DEPLOY.md](./DEPLOY.md)（Nginx 反代 + pm2）。

## License

MIT
