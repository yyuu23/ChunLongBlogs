import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts, projects, series } from "@/lib/db/schema";
import { LAB_DEMOS } from "@/lib/lab/catalog";

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
    "/projects",
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
  let contentPages: MetadataRoute.Sitemap = [];
  try {
    const [rows, seriesRows, projectRows] = await Promise.all([
      db.select({ slug: posts.slug, updated: posts.updatedAt }).from(posts).where(eq(posts.status, "published")).orderBy(desc(posts.publishedAt)),
      db.select({ slug: series.slug, updated: series.updatedAt }).from(series).where(eq(series.status, "published")),
      db.select({ slug: projects.slug, updated: projects.updatedAt }).from(projects).where(eq(projects.status, "published")),
    ]);
    postPages = rows.map((r) => ({
      url: `${base}/posts/${r.slug}`,
      lastModified: r.updated,
      changeFrequency: "monthly",
      priority: 0.8,
    }));
    contentPages = [
      ...seriesRows.map((row) => ({ url: `${base}/series/${row.slug}`, lastModified: row.updated, changeFrequency: "monthly" as const, priority: 0.65 })),
      ...projectRows.map((row) => ({ url: `${base}/projects/${row.slug}`, lastModified: row.updated, changeFrequency: "monthly" as const, priority: 0.75 })),
    ];
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

  return [...staticPages, ...postPages, ...contentPages, ...demoPages];
}
