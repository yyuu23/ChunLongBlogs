import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

/**
 * POST /api/bottles/open 集成测试（临时库）。
 * 开瓶不可逆：原子开瓶（WHERE opened_at IS NULL）、重复开幂等、非属主 404。
 */

let api: typeof import("@/app/api/bottles/open/route");
let raw: Database.Database;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cl-bottles-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  raw = new Database(process.env.DATABASE_PATH);
  raw.exec(`CREATE TABLE bottles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref_key TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL DEFAULT 'sakura',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    opened_at INTEGER
  )`);
  const add = raw.prepare("INSERT INTO bottles (visitor_id, kind, ref_key, theme) VALUES (?, ?, ?, ?)");
  add.run("v-A", "star", "1", "sakura");
  add.run("v-A", "festival", "solar-dongzhi", "snow");
  add.run("v-B", "star", "2", "firefly");
  api = await import("@/app/api/bottles/open/route");
});

const open = (visitorId: string, bottleId: number) =>
  api.POST(
    new Request("http://localhost/api/bottles/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, bottleId }),
    }),
  );

describe("POST /api/bottles/open", () => {
  it("开瓶成功返回 openedAt；重复开幂等（already）且时间不变", async () => {
    const first = await open("v-A", 1);
    expect(first.status).toBe(200);
    const d1 = (await first.json()) as { ok: boolean; openedAt: number };
    expect(d1.ok).toBe(true);
    expect(d1.openedAt).toBeTruthy();

    const again = await open("v-A", 1);
    const d2 = (await again.json()) as { ok: boolean; already?: boolean; openedAt: number };
    expect(d2.already).toBe(true);
    expect(d2.openedAt).toBe(d1.openedAt); // 幂等：不覆盖首次开瓶时间
  });

  it("别人的瓶子打不开（404），不产生任何写入", async () => {
    const res = await open("v-A", 3); // 3 号瓶属于 v-B
    expect(res.status).toBe(404);
    const row = raw.prepare("SELECT opened_at FROM bottles WHERE id = 3").get() as { opened_at: number | null };
    expect(row.opened_at).toBeNull();
  });

  it("参数非法 400", async () => {
    expect((await open("", 1)).status).toBe(400);
    expect((await open("v-A", 0)).status).toBe(400);
  });
});
