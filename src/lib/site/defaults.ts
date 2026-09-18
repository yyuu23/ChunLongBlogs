import type { SiteConfig } from "@/lib/site/types";

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: "ChunLong Blog",
  siteDescription: "一个关于代码与生活的个人博客",
  authorName: "ChunLong",
  avatar: "/assets/avatar.svg",
  bio: "在代码与生活之间，记录每一刻灵感。",
  socials: [
    { platform: "github", url: "https://github.com/yyuu23", label: "GitHub" },
    { platform: "email", url: "mailto:2907633023@qq.com", label: "邮箱" },
  ],
  announcement: { enabled: true },
  bgMode: "image",
  bgImages: [
    "/assets/bg/anime-1.webp",
    "/assets/bg/anime-2.webp",
    "/assets/bg/anime-3.webp",
    "/assets/bg/anime-4.webp",
    "/assets/bg/anime-5.webp",
    "/assets/bg/anime-6.webp",
  ],
  bgMaskOpacity: 0.3,
  bgMaskBlur: 0,
  banners: [
    {
      image: "/assets/bg/anime-1.webp",
      title: "你好，我是 ChunLong",
      subtitle: "这里记录我的代码、思考与生活",
    },
    {
      image: "/assets/bg/anime-3.webp",
      title: "代码即诗",
      subtitle: "用 Next.js 与毛玻璃打造的一方天地",
    },
    {
      image: "/assets/bg/anime-5.webp",
      title: "慢下来，写点东西",
      subtitle: "技术 · 随笔 · 日常",
    },
  ],
  gradientPalette: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"],
  aboutMarkdown: `## 关于我

你好，我是 **ChunLong**。

这是一个使用 Next.js 全栈构建的个人博客，拥有毛玻璃视觉、主题粒子与完整的写作后台。

- 🛠 技术栈：React / Next.js / TypeScript / SQLite
- 📮 联系我：2907633023@qq.com

> 把"想做"变成"做完"，是博客存在的意义。
`,
  icp: "",
  footerText: "",
  ccLicense: "BY-NC-SA 4.0",
  aiPersona: "你是 ChunLong Blog 的看板娘小助手，性格活泼，回答简洁友好，偶尔使用颜文字。用中文回答。",
  festivalQuotes: {},
  aiChat: {
    choices: [
      { id: "glm", label: "GLM 5.3 Flash", provider: "glm", cost: 12, promo: { originalCost: 24, label: "限时半价", until: "2026-09-15" } },
      { id: "deepseek", label: "DeepSeek V4 Flash", provider: "deepseek", model: "deepseek-v4-flash-vision-exp", cost: 15 },
      { id: "qwen", label: "Qwen 3.8 Flash", provider: "qwen", cost: 10 },
    ],
    defaultChoice: "glm",
    defaultEffort: "low",
    allowVisitorChoice: true,
    perVisitorHourly: 15,
    perVisitorDaily: 60,
    effortCost: { off: 1, low: 1, mid: 2, high: 4, max: 6, on: 6 },
    credits: { enabled: true, dailyGrant: 500, checkinBonus: 100, levelBonusPerLevel: 5 },
  },
};
