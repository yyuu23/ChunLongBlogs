import { getPublishedPosts, getPostBySlug } from "@/lib/posts";
import { renderMarkdown } from "@/lib/markdown";
import { getSiteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const [config, { items }] = await Promise.all([
    getSiteConfig(),
    getPublishedPosts({ perPage: 30 }),
  ]);
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  // 全文输出：复用与文章页相同的 Markdown 管线（shiki 高亮/KaTeX/GFM）。
  // 不传 cacheKey——避免 30 篇 RSS 与文章页 SSR 争抢 32 槽 LRU 缓存；
  // 体积靠 Cache-Control 3600 + nginx gzip 兜底。
  const posts = await Promise.all(
    items.map(async (p) => ({
      ...p,
      html: await (async () => {
        const full = await getPostBySlug(p.slug);
        return full ? await renderMarkdown(full.content) : "";
      })(),
    })),
  );

  const itemsXml = posts
    .map((p) => {
      const url = `${siteUrl}/posts/${p.slug}`;
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(p.description)}</description>
      <content:encoded>${escapeXml(p.html)}</content:encoded>
      <pubDate>${new Date(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate>
      ${p.tags.map((t) => `<category>${escapeXml(t.name)}</category>`).join("\n      ")}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(config.siteName)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(config.siteDescription)}</description>
    <language>zh-CN</language>
    <atom:link href="${siteUrl}/feed" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
