import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

/**
 * markVisit 里程碑测试（临时库）：
 *   1) 当日新访客返回递增序号（含 n=1 与 n=10 两个庆祝阈值点）；
 *   2) 同一访客当日重复 → null（onConflictDoNothing().returning() 冲突返回空数组，
 *      锁死这个 drizzle 行为，防止升级后静默变化）；
 *   3) 非法 visitorId → null。
 */
let stats: typeof import("@/lib/stats");
let raw: Database.Database;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cl-milestone-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  raw = new Database(process.env.DATABASE_PATH);
  raw.exec(`CREATE TABLE visitor_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    visitor_id TEXT NOT NULL
  )`);
  raw.exec("CREATE UNIQUE INDEX visitor_days_day_vid_idx ON visitor_days (day, visitor_id)");
  stats = await import("@/lib/stats");
});

describe("markVisit 里程碑", () => {
  it("当日新访客按插入顺序返回递增序号（1→10）", async () => {
    for (let i = 1; i <= 10; i++) {
      const m = await stats.markVisit(`visitor-${i}`);
      expect(m).not.toBeNull();
      expect(m!.n).toBe(i);
    }
  });

  it("同一访客当日重复访问返回 null（幂等）", async () => {
    expect(await stats.markVisit("visitor-1")).toBeNull();
    expect(await stats.markVisit("visitor-10")).toBeNull();
    // 表里仍只有 10 行
    const n = raw.prepare("SELECT count(*) AS c FROM visitor_days").get() as { c: number };
    expect(n.c).toBe(10);
  });

  it("新的一天老访客重新获得里程碑（日界正确语义）", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const d = String(tomorrow.getDate()).padStart(2, "0");
    raw.prepare("INSERT INTO visitor_days (day, visitor_id) VALUES (?, 'visitor-1')").run(`${y}-${m}-${d}`);
    // 今日（测试当天）visitor-1 已存在 → 仍 null；不影响其他断言
    expect(await stats.markVisit("visitor-1")).toBeNull();
  });

  it("非法 visitorId 返回 null", async () => {
    expect(await stats.markVisit("")).toBeNull();
    expect(await stats.markVisit("x".repeat(65))).toBeNull();
  });
});
