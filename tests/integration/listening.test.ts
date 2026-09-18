import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

/**
 * touchSongPlayed（"最近在听"卡）测试（临时库）：
 *   1) songId 命中 → 该歌 lastPlayedAt 更新为当前时间；
 *   2) songId 未命中 → 按 title 回退（救网易云重导入换 id 场景）；
 *   3) 都未命中 → 静默无变化。
 */
let stats: typeof import("@/lib/analytics/stats");
let raw: Database.Database;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cl-listening-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  raw = new Database(process.env.DATABASE_PATH);
  raw.exec(`CREATE TABLE songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    cover TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    lrc TEXT NOT NULL DEFAULT '',
    duration INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    last_played_at INTEGER
  )`);
  const insert = raw.prepare("INSERT INTO songs (playlist_id, title) VALUES (1, ?)");
  insert.run("晴天");
  insert.run("稻香");
  insert.run("夜曲");
  stats = await import("@/lib/analytics/stats");
});

const lastPlayedAtOf = (id: number) =>
  (raw.prepare("SELECT last_played_at AS t FROM songs WHERE id = ?").get(id) as { t: number | null }).t;

describe("touchSongPlayed", () => {
  it("songId 命中：更新对应歌曲", async () => {
    const before = Date.now();
    await stats.touchSongPlayed(2, "无关标题");
    const t = lastPlayedAtOf(2);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThanOrEqual(before);
    expect(lastPlayedAtOf(1)).toBeNull(); // 其他歌不受影响
  });

  it("songId 未命中：按 title 回退（重导入换 id 场景）", async () => {
    await new Promise((r) => setTimeout(r, 5)); // 保证时间戳前进
    await stats.touchSongPlayed(999, "夜曲");
    expect(lastPlayedAtOf(3)).not.toBeNull();
    expect(lastPlayedAtOf(3)!).toBeGreaterThan(lastPlayedAtOf(2)!);
  });

  it("id 与 title 都未命中：静默无变化", async () => {
    await stats.touchSongPlayed(999, "不存在的歌");
    expect(lastPlayedAtOf(1)).toBeNull();
    // 无异常即通过
  });
});
