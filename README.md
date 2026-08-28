# ChunLong Blog

一个 Next.js 全栈个人博客：毛玻璃视觉 + 主题粒子动效 + 内置完整管理后台。

## 特性

- **公开站点**
  - 首页：Banner 轮播、个人资料卡、节气公告栏、最新文章
  - 文章：列表/网格双视图、分类与标签筛选（数量角标）、分页
  - 详情：Shiki 代码高亮、KaTeX 公式、GitHub 风格提示框、目录 TOC、giscus 评论、阅读量统计
  - 归档时间线、说说、友链、相册（灯箱预览）、关于、RSS 订阅、站内搜索
- **华丽体验**：亮色樱花 / 暗色萤火虫主题粒子、背景图轮播 + 流动渐变光球、Canvas 点击爆破、开场启动屏、页面过渡、滚动渐入、3D 倾斜卡片、暗色模式平滑切换、移动端底部 Tab
- **管理后台 `/admin`**：Markdown 编辑器实时预览、封面与图片上传、文章/分类/说说/友链/相册/站点配置全管理

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · framer-motion · SQLite + Drizzle ORM · jose JWT · unified/remark/rehype + Shiki · giscus

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
