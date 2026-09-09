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
  /** 每条消息基准积分（✦）；缺省用供应商默认（glm 12 / deepseek 15 / qwen 10） */
  cost?: number;
  /** API 牌价（元/百万 tokens，admin 换算基准积分用；扣费只看 cost） */
  apiPrice?: {
    input?: number;
    output?: number;
    /** 缓存命中输入价（换算按 50% 命中率估算） */
    cache?: number;
    /** 输出膨胀倍数（强制思考模型填 3：思维链计入输出计费） */
    outputMult?: number;
  };
  /** 限时促销展示：划线原价 + 标签 + 截止日（YYYY-MM-DD，过期自动隐藏；仅展示，扣费以 cost 为准） */
  promo?: { originalCost?: number; label?: string; until?: string };
  /** @deprecated 已由访客侧思考强度滑条取代，仅为兼容旧配置保留、逻辑忽略 */
  thinking?: boolean;
}

/** 站长在 admin 配置的自定义 HTTP 工具：AI 可调用，服务端中转 POST 到指定端点 */
export interface AiCustomTool {
  id: string;
  /** 工具名（模型可见，英文/数字/下划线，如 get_weather） */
  name: string;
  /** 给模型看的功能描述（决定模型什么时候调用它） */
  description: string;
  /** POST 端点，收到 {name, args} JSON，返回 JSON 结果 */
  endpoint: string;
}

/** AI 积分（✦）体系配置：每日重置 + 对话按量扣减；enabled=false 整体回退旧的每日次数限制 */
export interface AiCreditsConfig {
  enabled: boolean;
  /** 每日额度（每天重置为该值+等级加成，昨日余额不结转累加） */
  dailyGrant: number;
  /** 每日签到加成 */
  checkinBonus: number;
  /** 每等级加成/日（Lv 越高领越多） */
  levelBonusPerLevel: number;
  /** DeepSeek 高峰时段积分倍率（北京时间工作日 9-12/14-18），≥2 生效 */
  peakMultiplier?: number;
  /** 定价加价倍数（API 价格换算积分用：成本 × 此倍数 = 售价，默认 2） */
  pricingMarkup?: number;
  /** 换算预估：单条消息输入 tokens（默认 4000，含 system/历史/RAG） */
  estInputTokens?: number;
  /** 换算预估：单条消息输出 tokens（默认 1000；思考膨胀由各模型的 outputMult 表达） */
  estOutputTokens?: number;
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
  /** @deprecated 积分体系启用时不再生效（积分天然限速）；仅在 credits.enabled=false 时回退生效，UI 已移除 */
  perVisitorHourly: number;
  /** @deprecated 同上：仅在 credits.enabled=false 时回退生效，UI 已移除 */
  perVisitorDaily: number;
  /** 内置工具开关（key=工具名；缺省视为开启；web_search 还需配置搜索 key） */
  tools?: Record<string, boolean>;
  /** 自定义 HTTP 工具（最多 6 个） */
  customTools?: AiCustomTool[];
  /** 档位倍率：每条消息积分 = 模型基准价 × 倍率（缺省 off/low 1、mid 2、high 4、max/on 6） */
  effortCost?: Partial<Record<import("@/lib/llm-thinking").ThinkingLevel, number>>;
  /** 积分体系配置（缺省 enabled + 500/日 + 签到 100 + 每等级 5） */
  credits?: AiCreditsConfig;
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
