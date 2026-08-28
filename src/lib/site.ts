import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { siteConfigs } from "./db/schema";

export interface SocialLink {
  platform: string; // github | bilibili | gitee | email | rss | link
  url: string;
  label?: string;
}

export interface Banner {
  image: string;
  title: string;
  subtitle: string;
}

export interface GiscusConfig {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
}

export interface SiteConfig {
  siteName: string;
  siteDescription: string;
  authorName: string;
  avatar: string;
  bio: string;
  socials: SocialLink[];
  announcement: { enabled: boolean; customText?: string };
  bgMode: "image" | "gradient";
  bgImages: string[];
  banners: Banner[];
  gradientPalette: string[];
  giscus: GiscusConfig | null;
  aboutMarkdown: string;
  icp: string;
  footerText: string;
  /** 知识共享协议，如 "BY-NC-SA 4.0"；留空则不显示 */
  ccLicense: string;
}

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
    "/assets/bg/bg-1.svg",
    "/assets/bg/bg-2.svg",
    "/assets/bg/bg-3.svg",
    "/assets/bg/bg-4.svg",
  ],
  banners: [
    {
      image: "/assets/bg/bg-1.svg",
      title: "你好，我是 ChunLong",
      subtitle: "这里记录我的代码、思考与生活",
    },
    {
      image: "/assets/bg/bg-2.svg",
      title: "代码即诗",
      subtitle: "用 Next.js 与毛玻璃打造的一方天地",
    },
    {
      image: "/assets/bg/bg-4.svg",
      title: "慢下来，写点东西",
      subtitle: "技术 · 随笔 · 日常",
    },
  ],
  gradientPalette: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"],
  giscus: null,
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
};

export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  try {
    const rows = await db
      .select()
      .from(siteConfigs)
      .where(eq(siteConfigs.key, "site"))
      .limit(1);
    if (!rows.length) return DEFAULT_SITE_CONFIG;
    const stored = JSON.parse(rows[0].value) as Partial<SiteConfig>;
    return { ...DEFAULT_SITE_CONFIG, ...stored };
  } catch {
    // 数据库尚未初始化时兜底，保证页面可渲染
    return DEFAULT_SITE_CONFIG;
  }
});

export async function saveSiteConfig(config: SiteConfig) {
  await db
    .insert(siteConfigs)
    .values({ key: "site", value: JSON.stringify(config) })
    .onConflictDoUpdate({
      target: siteConfigs.key,
      set: { value: JSON.stringify(config), updatedAt: new Date() },
    });
}
