import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

/**
 * 定时发布惰性触发测试（临时库）：
 *   1) 过期 scheduled → 转 published 且 publishedAt 保留原目标时刻；
 *   2) 未到期 scheduled / 已 published 不受影响；
 *   3) 60 秒节流：连续第二次调用直接返回（同样数据无重复处理）。
 * checkScheduledPosts 内 revalidatePath 读 next/cache —— mock 掉；RAG 动态 import
 * 在无 EMBEDDING_API_KEY 时 rebuild 走 error 分支不写库，无需 mock。
 */
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let scheduled: typeof import("@/lib/content/scheduled");
let raw: Database.Database;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cl-scheduled-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  delete process.env.EMBEDDING_API_KEY;
  raw = new Database(process.env.DATABASE_PATH);
  raw.exec(`CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    cover TEXT NOT NULL DEFAULT '',
    category_id INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    reading_time INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    published_at INTEGER
  )`);
  const insert = raw.prepare(
    "INSERT INTO posts (title, slug, status, published_at) VALUES (?, ?, ?, ?)",
  );
  insert.run("过期定时", "overdue", "scheduled", Date.now() - 60_000);
  insert.run("未到期", "future", "scheduled", Date.now() + 3_600_000);
  insert.run("已发布", "out", "published", Date.now() - 100_000);
  scheduled = await import("@/lib/content/scheduled");
});

const statusOf = (slug: string) =>
  (raw.prepare("SELECT status, published_at FROM posts WHERE slug = ?").get(slug) as { status: string; published_at: number | null });

describe("checkScheduledPosts", () => {
  it("过期定时转 published 且保留目标时刻；其他不动", async () => {
    await scheduled.checkScheduledPosts();
    const overdue = statusOf("overdue");
    expect(overdue.status).toBe("published");
    expect(overdue.published_at).toBeLessThanOrEqual(Date.now() - 50_000); // 保留原值（过去时刻），未刷成 now
    expect(statusOf("future").status).toBe("scheduled");
    expect(statusOf("out").status).toBe("published");
  });

  it("60 秒节流：第二次调用直接返回", async () => {
    raw.prepare("UPDATE posts SET status = 'scheduled' WHERE slug = 'future'").run();
    raw.prepare("UPDATE posts SET published_at = ? WHERE slug = 'future'").run(Date.now() - 1_000);
    await scheduled.checkScheduledPosts(); // 节流内，不处理
    expect(statusOf("future").status).toBe("scheduled");
  });
});
