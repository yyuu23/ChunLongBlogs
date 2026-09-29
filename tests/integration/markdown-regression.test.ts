import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";

/**
 * 一次性回归：sanitize 管线改造（rehype-raw + rehype-sanitize）前后，
 * 现网全部已发布文章 + aboutMarkdown 的渲染结果必须语义零差异。
 * 现网内容零裸 HTML（调查阶段已确认），此测试证明加固对存量内容无感。
 * fixture old-markdown.ts 由 git show HEAD:src/lib/content/markdown.ts 导出。
 * 对比前做空白规范化：rehype-raw 会把源码换行保留为 body 级 text 节点，
 * HTML 渲染时折叠、语义等价，不视为差异。
 */
const normalize = (html: string) =>
  html
    .replace(/>\s+</g, "><") // 标签间空白（rehype-raw 重解析的遗留）渲染时折叠，语义等价
    .replace(/\s+/g, " ")
    .trim();

describe("markdown 管线加固回归（新旧语义零差异）", () => {
  it("现网 11 篇已发布文章渲染结果与旧管线语义一致", async () => {
    const { renderMarkdown: renderOld } = await import("../_fixtures/old-markdown");
    const { renderMarkdown: renderNew } = await import("@/lib/content/markdown");

    const db = new Database("data/db.sqlite", { readonly: true });
    const posts = db
      .prepare("SELECT id, content, updated_at FROM posts WHERE status = 'published'")
      .all() as Array<{ id: number; content: string; updated_at: number }>;

    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      const key = `reg:${post.id}:${post.updated_at}`;
      const [oldHtml, newHtml] = await Promise.all([
        renderOld(post.content, `old-${key}`),
        renderNew(post.content, `new-${key}`),
      ]);
      expect(normalize(newHtml), `post ${post.id} 渲染出现差异`).toBe(normalize(oldHtml));
    }
  });

  it("aboutMarkdown 渲染结果与旧管线语义一致", async () => {
    const { renderMarkdown: renderOld } = await import("../_fixtures/old-markdown");
    const { renderMarkdown: renderNew } = await import("@/lib/content/markdown");

    const db = new Database("data/db.sqlite", { readonly: true });
    const row = db.prepare("SELECT value FROM site_configs WHERE key = 'site'").get() as
      | { value: string }
      | undefined;
    const about = row ? (JSON.parse(row.value) as { aboutMarkdown?: string }).aboutMarkdown ?? "" : "";

    const oldHtml = await renderOld(about, "reg-about-old");
    const newHtml = await renderNew(about, "reg-about-new");
    expect(normalize(newHtml)).toBe(normalize(oldHtml));
  });
});
