import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { LAB_DEMOS } from "@/lib/lab-demos";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "http://localhost:3000";

  const staticPages: MetadataRoute.Sitemap = [
    "",
    "/posts",
    "/archive",
    "/moments",
    "/albums",
    "/friends",
    "/about",
    // 功能页：收录但降权（应用型页面，内容更新频率低）
    "/music",
    "/lab",
    "/chat",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : ["/music", "/lab", "/chat"].includes(path) ? 0.5 : 0.7,
  }));

  let postPages: MetadataRoute.Sitemap = [];
  try {
    const rows = await db
      .select({ slug: posts.slug, updated: posts.updatedAt })
      .from(posts)
      .where(eq(posts.status, "published"))
      .orderBy(desc(posts.publishedAt));
    postPages = rows.map((r) => ({
      url: `${base}/posts/${r.slug}`,
      lastModified: r.updated,
      changeFrequency: "monthly",
      priority: 0.8,
    }));
  } catch {
    // 数据库不可用时至少返回静态页
  }

  // 实验台 demo 页：可分享的独立小实验（注册表单一事实来源）
  const demoPages: MetadataRoute.Sitemap = LAB_DEMOS.map((d) => ({
    url: `${base}/lab/${d.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticPages, ...postPages, ...demoPages];
}
