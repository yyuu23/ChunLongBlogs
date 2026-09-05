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

/** 支持的 LLM 供应商（key 都放 .env，这里只决定路由） */
export type AiProvider = "deepseek" | "glm" | "qwen";

/** 一个暴露给访客的模型预设（/admin/ai-chat 管理） */
export interface AiChatChoice {
  /** 稳定 id（如 "glm"），访客选择时回传 */
  id: string;
  /** 访客可见名称 */
  label: string;
  provider: AiProvider;
  /** 覆盖该供应商默认模型名（不填用 env/内置默认） */
  model?: string;
  /** @deprecated 已由访客侧思考强度滑条取代，仅为兼容旧配置保留、逻辑忽略 */
  thinking?: boolean;
}

export interface AiChatConfig {
  /** 暴露给访客的模型预设（未配置 key 的供应商自动对访客隐藏） */
  choices: AiChatChoice[];
  /** 默认预设 id */
  defaultChoice: string;
  /** 默认思考强度档位（不在默认模型档位内时自动回退首档） */
  defaultEffort: string;
  /** false = 访客无选择器，固定用默认预设 */
  allowVisitorChoice: boolean;
  /** 每访客每小时消息数（滑动窗口，0 = 不限） */
  perVisitorHourly: number;
  /** 每访客每天消息数（0 = 不限） */
  perVisitorDaily: number;
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
  /** AI 对话模型预设与每访客限额（/admin/ai-chat 管理） */
  aiChat: AiChatConfig;
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
  aiChat: {
    choices: [
      { id: "glm", label: "GLM 5.3 Flash", provider: "glm" },
      { id: "deepseek", label: "DeepSeek V4 Flash", provider: "deepseek" },
      { id: "qwen", label: "Qwen 3.8 Flash", provider: "qwen" },
    ],
    defaultChoice: "glm",
    defaultEffort: "low",
    allowVisitorChoice: true,
    perVisitorHourly: 15,
    perVisitorDaily: 60,
  },
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
    // aiChat 是嵌套对象，浅合并会整体替换——对它单独合默认值，防残缺数据缺字段
    return {
      ...DEFAULT_SITE_CONFIG,
      ...stored,
      aiChat: { ...DEFAULT_SITE_CONFIG.aiChat, ...(stored.aiChat ?? {}) },
    };
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
