import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

/**
 * Markdown 批量导入测试（临时库，读真实 content/posts/ 文件）：
 *   1) 从内容目录导入：文章全部入库（published，除显式 draft），
 *      front-matter 的分类/标签/字数/阅读时长正确映射；
 *   2) 幂等：重复导入全部走 updated，不产生重复行；
 *   3) 更新语义：改写一篇文件再导入，正文与字数更新。
 * guard 读 next/headers、revalidatePath 读 next/cache —— node 环境均 mock 掉。
 */
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => new Map() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  getSession: async () => ({ username: "test" }),
  createSession: async () => {},
  destroySession: async () => {},
}));

let actions: typeof import("@/app/admin/actions/posts");
let raw: Database.Database;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cl-import-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  raw = new Database(process.env.DATABASE_PATH);
  raw.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, color TEXT NOT NULL DEFAULT '#6366f1', created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));
    CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE);
    CREATE TABLE series (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      cover TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      series_id INTEGER REFERENCES series(id) ON DELETE SET NULL,
      series_order INTEGER NOT NULL DEFAULT 0,
      difficulty TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled')),
      is_pinned INTEGER NOT NULL DEFAULT 0,
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      word_count INTEGER NOT NULL DEFAULT 0,
      reading_time INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      published_at INTEGER
    );
    CREATE TABLE post_tags (post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (post_id, tag_id));
  `);
  actions = await import("@/app/admin/actions/posts");
});

const mdCount = () => readdirSync(join(process.cwd(), "content/posts")).filter((f) => f.endsWith(".md")).length;

describe("Markdown 内容目录导入", () => {
  it("首次导入：全部 .md 入库，published/draft 正确，分类标签挂载", async () => {
    const results = await actions.importMarkdownFromContentDir();
    expect(results).toHaveLength(mdCount());
    expect(results.every((r) => r.outcome === "created")).toBe(true);

    const rows = raw.prepare("SELECT slug, status, word_count, reading_time, category_id FROM posts").all() as {
      slug: string; status: string; word_count: number; reading_time: number; category_id: number | null;
    }[];
    expect(rows).toHaveLength(mdCount());
    // 显式 draft 的演示文保持草稿，其余全部发布
    const drafts = rows.filter((r) => r.status === "draft").map((r) => r.slug);
    expect(drafts).toEqual(["summer-ending-draft"]);

    const noise = rows.find((r) => r.slug === "noise-sample-loop");
    expect(noise?.status).toBe("published");
    expect(noise!.word_count).toBeGreaterThan(500);
    expect(noise!.reading_time).toBeGreaterThanOrEqual(1);
    expect(noise!.category_id).not.toBeNull();

    // 标签关联：技术分类的文章挂了标签
    const tagCount = raw
      .prepare("SELECT count(*) c FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE p.slug = 'noise-sample-loop'")
      .get() as { c: number };
    expect(tagCount.c).toBe(2);
  });

  it("重复导入幂等：全部 updated，无重复行", async () => {
    const before = (raw.prepare("SELECT count(*) c FROM posts").get() as { c: number }).c;
    const results = await actions.importMarkdownFromContentDir();
    expect(results.every((r) => r.outcome === "updated")).toBe(true);
    const after = (raw.prepare("SELECT count(*) c FROM posts").get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it("文件上传入口：内容更新后 wordCount 跟随", async () => {
    const long = `---\ntitle: 临时测试文\nslug: tmp-import-check\ncategory: tech\ntags: [测试]\ndate: 2026-09-15\n---\n\n${"这是一段用于校验字数统计的正文。".repeat(60)}`;
    const r1 = await actions.importMarkdownFiles([{ name: "tmp.md", text: long }]);
    expect(r1[0]!.outcome).toBe("created");
    const short = long.replace(".repeat", "").slice(0, 0) + `---\ntitle: 临时测试文\nslug: tmp-import-check\ncategory: tech\ntags: [测试]\ndate: 2026-09-15\n---\n\n短文`;
    const r2 = await actions.importMarkdownFiles([{ name: "tmp.md", text: short }]);
    expect(r2[0]!.outcome).toBe("updated");
    const wc = raw
      .prepare("SELECT word_count w FROM posts WHERE slug = 'tmp-import-check'")
      .get() as { w: number };
    expect(wc.w).toBeLessThan(20);
    raw.prepare("DELETE FROM posts WHERE slug = 'tmp-import-check'").run();
  });
});
