import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

/**
 * /api/stars 集成测试（临时库）。
 * 核心回归点：「找到我的星」依赖的三个行为——
 *   1) ?visitorId= 时自己的星带 mine 标记；
 *   2) 自己的星即使被最新 80 颗窗口顶出去也照常返回（80 ∪ 自己）；
 *   3) 软删除的星对公开接口不可见。
 * DATABASE_PATH 必须在动态 import 之前设置（db 是模块级单例）。
 */

let api: typeof import("@/app/api/stars/route");
let raw: Database.Database;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cl-stars-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  raw = new Database(process.env.DATABASE_PATH);
  raw.exec(`CREATE TABLE stars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    visitor_id TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    featured INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
  )`);
  const add = raw.prepare(
    "INSERT INTO stars (content, visitor_id, created_at, featured, deleted_at) VALUES (?, ?, ?, ?, ?)",
  );
  // A2：v-A 的旧星（先插，随后被 85 颗填充星顶出 80 窗口）
  add.run("旧星-A2", "v-A", Date.now() - 90_000, 0, null);
  for (let i = 0; i < 85; i++) add.run(`filler-${i}`, `v-F${i}`, Date.now() - 80_000 + i, 0, null);
  // A1：v-A 的新星（窗口内）
  add.run("新星-A1", "v-A", Date.now() - 1000, 0, null);
  // B1：别人的精选星；D1：软删除星
  add.run("精选-B1", "v-B", Date.now() - 500, 1, null);
  add.run("已删-D1", "v-C", Date.now() - 400, 0, Date.now() - 300);

  api = await import("@/app/api/stars/route");
});

const get = async (qs = "") =>
  (await (await api.GET(new Request(`http://localhost/api/stars${qs}`))).json()) as {
    stars: { id: number; content: string; mine?: boolean; featured?: boolean }[];
  };

describe("GET /api/stars", () => {
  it("无参：软删不可见、无 mine 标记、featured 透出、最多 80 颗", async () => {
    const { stars } = await get();
    expect(stars.length).toBe(80);
    expect(stars.some((s) => s.content === "已删-D1")).toBe(false);
    expect(stars.some((s) => s.content === "旧星-A2")).toBe(false); // 窗口外
    expect(stars.every((s) => s.mine === undefined)).toBe(true);
    expect(stars.find((s) => s.content === "精选-B1")?.featured).toBe(true);
  });

  it("带 visitorId：自己的星带 mine，窗口外的也回来（80 ∪ 自己）", async () => {
    const { stars } = await get("?visitorId=v-A");
    const a2 = stars.find((s) => s.content === "旧星-A2");
    const a1 = stars.find((s) => s.content === "新星-A1");
    expect(a1?.mine).toBe(true); // 窗口内
    expect(a2).toBeTruthy(); // 窗口外仍返回
    expect(a2?.mine).toBe(true);
    expect(stars.find((s) => s.content === "filler-0")?.mine).toBeUndefined();
    // v-A 视角同样看不到软删星
    expect(stars.some((s) => s.content === "已删-D1")).toBe(false);
  });

  it("别人的 visitorId 拿不到 v-A 的 mine 标记", async () => {
    const { stars } = await get("?visitorId=v-B");
    expect(stars.find((s) => s.content === "新星-A1")?.mine).toBeUndefined();
    expect(stars.find((s) => s.content === "精选-B1")?.mine).toBe(true);
  });
});

describe("POST /api/stars", () => {
  it("留星成功返回 mine，24 小时内第 4 条被拒", async () => {
    const post = (content: string, visitorId: string) =>
      api.POST(
        new Request("http://localhost/api/stars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, visitorId }),
        }),
      );

    for (let i = 1; i <= 3; i++) {
      const res = await post(`v-D 的第 ${i} 颗星`, "v-D");
      expect(res.status).toBe(200);
      const data = (await res.json()) as { star?: { mine?: boolean } };
      expect(data.star?.mine).toBe(true);
    }
    const fourth = await post("第四颗", "v-D");
    expect(fourth.status).toBe(429);
  });
});
