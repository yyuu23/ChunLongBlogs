import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";

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

  return [...staticPages, ...postPages];
}
