import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteConfigs } from "@/lib/db/schema";
import { DEFAULT_SITE_CONFIG } from "@/lib/site/defaults";
import type { SiteConfig } from "@/lib/site/types";

const loadSiteConfig = cache(async (): Promise<SiteConfig> => {
  try {
    const rows = await db
      .select()
      .from(siteConfigs)
      .where(eq(siteConfigs.key, "site"))
      .limit(1);
    if (!rows.length) return DEFAULT_SITE_CONFIG;
    const stored = JSON.parse(rows[0].value) as Partial<SiteConfig>;
    return {
      ...DEFAULT_SITE_CONFIG,
      ...stored,
      aiChat: { ...DEFAULT_SITE_CONFIG.aiChat, ...(stored.aiChat ?? {}) },
    };
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
});

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
