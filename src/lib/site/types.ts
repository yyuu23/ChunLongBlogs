import type { ThinkingLevel } from "@/lib/ai/thinking";

export interface SocialLink {
  platform: string;
  url: string;
  label?: string;
}

export interface Banner {
  image: string;
  title: string;
  subtitle: string;
}

export type AiProvider = "deepseek" | "glm" | "qwen";

export interface AiChatChoice {
  id: string;
  label: string;
  provider: AiProvider;
  model?: string;
  cost?: number;
  apiPrice?: {
    input?: number;
    output?: number;
    cache?: number;
    outputMult?: number;
  };
  promo?: { originalCost?: number; label?: string; until?: string };
  /** @deprecated 已由访客侧思考强度滑条取代。 */
  thinking?: boolean;
}

export interface AiCustomTool {
  id: string;
  name: string;
  description: string;
  endpoint: string;
}

export interface AiCreditsConfig {
  enabled: boolean;
  dailyGrant: number;
  checkinBonus: number;
  levelBonusPerLevel: number;
  peakMultiplier?: number;
  pricingMarkup?: number;
  estInputTokens?: number;
  estOutputTokens?: number;
}

export interface AiChatConfig {
  choices: AiChatChoice[];
  defaultChoice: string;
  defaultEffort: string;
  allowVisitorChoice: boolean;
  /** @deprecated 积分体系关闭时的兼容限额。 */
  perVisitorHourly: number;
  /** @deprecated 积分体系关闭时的兼容限额。 */
  perVisitorDaily: number;
  tools?: Record<string, boolean>;
  customTools?: AiCustomTool[];
  effortCost?: Partial<Record<ThinkingLevel, number>>;
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
  bgMaskOpacity: number;
  bgMaskBlur: number;
  banners: Banner[];
  gradientPalette: string[];
  aboutMarkdown: string;
  icp: string;
  footerText: string;
  ccLicense: string;
  aiPersona: string;
  aiChat: AiChatConfig;
  festivalQuotes?: Record<string, string>;
}
