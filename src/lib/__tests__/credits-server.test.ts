import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

/**
 * 积分服务端集成测试（临时库）。
 * DATABASE_PATH 必须在 import @/lib/db 之前设置——db 模块在加载时就初始化
 * 连接并缓存为模块级单例，所以这里用 beforeAll 里动态 import。
 * visitors 建表语句与 drizzle schema 保持一致（本测试只用到该表）。
 */

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const yesterday = () => iso(new Date(Date.now() - DAY));

let api: typeof import("@/lib/credits-server");
let raw: Database.Database;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cl-credits-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  raw = new Database(process.env.DATABASE_PATH);
  raw.exec(`CREATE TABLE visitors (
    id TEXT PRIMARY KEY,
    xp INTEGER NOT NULL DEFAULT 0,
    stats TEXT NOT NULL DEFAULT '{}',
    credits INTEGER NOT NULL DEFAULT 0,
    last_seen INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);
  api = await import("@/lib/credits-server");
});

/** 直接改库，模拟"昨天已重置过/旧逻辑累加出来的余额"等存量状态 */
function setRow(id: string, credits: number, stats: object, xp = 0) {
  raw
    .prepare("INSERT INTO visitors (id, xp, credits, stats) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET xp=excluded.xp, credits=excluded.credits, stats=excluded.stats")
    .run(id, xp, credits, JSON.stringify(stats));
}

describe("ensureDailyCredits：每日重置语义（回归测试——旧实现每天 +500 累加）", () => {
  it("新访客：建行并直接带当日额度（500 + Lv1×5）", async () => {
    const r = await api.ensureDailyCredits("v-new", 500, 5);
    expect(r).toEqual({ reset: true, balance: 505 });
  });

  it("当日重复触达：幂等跳过，不叠加（花掉 12 后仍保持 493 而非再重置）", async () => {
    const spend = await api.spendCredits("v-new", 12);
    expect(spend).toEqual({ ok: true, balance: 493 });
    const r = await api.ensureDailyCredits("v-new", 500, 5);
    expect(r).toEqual({ reset: false, balance: 493 });
  });

  it("跨日重置：余额「置为」当日额度，而不是在旧余额上加（3000 → 505，非 3505）", async () => {
    setRow("v-stale", 3000, { __credits: { date: yesterday() } });
    const r = await api.ensureDailyCredits("v-stale", 500, 5);
    expect(r).toEqual({ reset: true, balance: 505 });
  });

  it("重置同时打上当日标记，且不破坏 stats 里其它字段", async () => {
    setRow("v-keep", 100, { visitDays: 5, __credits: { date: yesterday() } });
    await api.ensureDailyCredits("v-keep", 500, 5);
    const row = raw.prepare("SELECT credits, stats FROM visitors WHERE id='v-keep'").get() as { credits: number; stats: string };
    const stats = JSON.parse(row.stats);
    expect(row.credits).toBe(505);
    expect(stats.__credits.date).toBe(iso(new Date()));
    expect(stats.visitDays).toBe(5);
  });

  it("等级加成按真实 xp 计算：xp=160（Lv3）→ 500 + 3×5 = 515", async () => {
    setRow("v-lvl", 0, { __credits: { date: yesterday() } }, 160);
    const r = await api.ensureDailyCredits("v-lvl", 500, 5);
    expect(r).toEqual({ reset: true, balance: 515 });
  });

  it("无标记的存量老数据（json_extract 返回 NULL）也会被重置", async () => {
    setRow("v-legacy", 9999, { visitDays: 3 });
    const r = await api.ensureDailyCredits("v-legacy", 500, 5);
    expect(r).toEqual({ reset: true, balance: 505 });
  });
});

describe("spendCredits：原子扣减", () => {
  it("余额足够：扣减成功并返回新余额", async () => {
    setRow("v-spend", 100, { __credits: { date: iso(new Date()) } });
    expect(await api.spendCredits("v-spend", 30)).toEqual({ ok: true, balance: 70 });
  });

  it("余额不足：拒绝且无写入副作用", async () => {
    setRow("v-poor", 5, { __credits: { date: iso(new Date()) } });
    expect(await api.spendCredits("v-poor", 30)).toEqual({ ok: false, balance: 5 });
  });
});
