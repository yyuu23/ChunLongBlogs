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
  /** 背景图遮罩浓度 0–1（亮色模式白色遮罩，暗色模式自动加深保证可读） */
  bgMaskOpacity: number;
  /** 背景图磨砂模糊强度 px（0 = 清晰显示背景图） */
  bgMaskBlur: number;
  banners: Banner[];
  gradientPalette: string[];
  giscus: GiscusConfig | null;
  aboutMarkdown: string;
  icp: string;
  footerText: string;
  /** 知识共享协议，如 "BY-NC-SA 4.0"；留空则不显示 */
  ccLicense: string;
  /** AI 聊天助手人设（system prompt） */
  aiPersona: string;
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
    "/assets/bg/anime-1.webp",
    "/assets/bg/anime-2.webp",
    "/assets/bg/anime-3.webp",
    "/assets/bg/anime-4.webp",
    "/assets/bg/anime-5.webp",
    "/assets/bg/anime-6.webp",
  ],
  bgMaskOpacity: 0.15,
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
  aiPersona: "你是 ChunLong Blog 的看板娘小助手，性格活泼，回答简洁友好，偶尔使用颜文字。用中文回答。",
};

/** 请求内去重（React cache）：同一请求的多次 getSiteConfig 只查一次库 */
const loadSiteConfig = cache(async (): Promise<SiteConfig> => {
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

/** 跨请求 30s TTL 缓存：站点配置每个页面都要读，全部缓存() 时每个请求
 * 仍各查一次 SQLite。单实例部署无一致性问题；保存后立即失效 */
const CONFIG_TTL_MS = 30_000;
let configCache: { at: number; value: SiteConfig } | null = null;

export async function getSiteConfig(): Promise<SiteConfig> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) {
    return configCache.value;
  }
  const value = await loadSiteConfig();
  configCache = { at: Date.now(), value };
  return value;
}

export async function saveSiteConfig(config: SiteConfig) {
  await db
    .insert(siteConfigs)
    .values({ key: "site", value: JSON.stringify(config) })
    .onConflictDoUpdate({
      target: siteConfigs.key,
      set: { value: JSON.stringify(config), updatedAt: new Date() },
    });
  configCache = null;
}
