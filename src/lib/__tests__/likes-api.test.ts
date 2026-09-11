import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

/**
 * /api/posts/[slug]/like 集成测试（临时库）。
 * 核心回归点：
 *   1) 游客点赞只计数、不进头像列表；幂等（同 visitorId 只 +1）；
 *   2) 登录用户点赞进头像列表（github_user_id 落库）；
 *   3) unlike 减计数且下限为 0；
 *   4) 未知 slug 404；每访客每日 50 次限流。
 * getUserSession 读 next/headers cookies，node 环境无请求上下文 → mock 掉。
 */

const sessionState = vi.hoisted(() => ({ userId: null as number | null }));
vi.mock("@/lib/authUser", () => ({
  getUserSession: async () => (sessionState.userId ? { userId: sessionState.userId } : null),
}));

let likeApi: typeof import("@/app/api/posts/[slug]/like/route");
let raw: Database.Database;

const POST_ID = 1;
const SLUG = "hello-world";

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cl-likes-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  raw = new Database(process.env.DATABASE_PATH);
  raw.exec(`CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft',
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    reading_time INTEGER NOT NULL DEFAULT 1
  )`);
  raw.exec(`CREATE TABLE github_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id INTEGER NOT NULL UNIQUE,
    login TEXT NOT NULL,
    avatar_url TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);
  raw.exec(`CREATE TABLE post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    visitor_id TEXT NOT NULL,
    github_user_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);
  raw.exec("CREATE UNIQUE INDEX post_likes_post_visitor_idx ON post_likes (post_id, visitor_id)");
  raw.prepare("INSERT INTO posts (slug, status) VALUES (?, 'published')").run(SLUG);
  raw.prepare("INSERT INTO github_users (github_id, login, avatar_url) VALUES (42, 'alice', 'https://a/alice.png')").run();

  likeApi = await import("@/app/api/posts/[slug]/like/route");
});

beforeEach(() => {
  sessionState.userId = null;
  raw.exec("DELETE FROM post_likes");
  raw.prepare("UPDATE posts SET likes = 0 WHERE id = ?").run(POST_ID);
});

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

const like = (visitorId: string, action: "like" | "unlike") =>
  likeApi.POST(
    new Request(`http://localhost/api/posts/${SLUG}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, action }),
    }),
    ctx(SLUG),
  );

const getLikes = async (visitorId: string) =>
  (await (
    await likeApi.GET(
      new Request(`http://localhost/api/posts/${SLUG}/like?visitorId=${visitorId}`),
      ctx(SLUG),
    )
  ).json()) as { likes: number; liked: boolean; likers: { login: string; avatarUrl: string }[] };

describe("POST /api/posts/[slug]/like", () => {
  it("游客点赞：计数 +1，头像列表为空；重复点赞幂等不叠加", async () => {
    const first = await like("v-guest", "like");
    expect(first.status).toBe(200);
    expect(((await first.json()) as { likes: number }).likes).toBe(1);

    const again = await like("v-guest", "like");
    expect(((await again.json()) as { likes: number }).likes).toBe(1); // unique(postId, visitorId) 去重

    const state = await getLikes("v-guest");
    expect(state.likes).toBe(1);
    expect(state.liked).toBe(true);
    expect(state.likers).toEqual([]); // 游客不进头像列表
  });

  it("登录用户点赞：进头像列表，github_user_id 落库", async () => {
    sessionState.userId = 1;
    const res = await like("v-user", "like");
    expect(res.status).toBe(200);
    const state = await getLikes("v-user");
    expect(state.likers).toEqual([{ login: "alice", avatarUrl: "https://a/alice.png" }]);
    const row = raw.prepare("SELECT github_user_id FROM post_likes WHERE visitor_id = 'v-user'").get() as {
      github_user_id: number;
    };
    expect(row.github_user_id).toBe(1);
  });

  it("unlike 减计数；未点赞时 unlike 计数不为负", async () => {
    await like("v-guest", "like");
    const off = await like("v-guest", "unlike");
    expect(((await off.json()) as { likes: number }).likes).toBe(0);
    const over = await like("v-guest", "unlike"); // 已是 0 再取消
    expect(((await over.json()) as { likes: number }).likes).toBe(0);
    expect(((await getLikes("v-guest")) as { liked: boolean }).liked).toBe(false);
  });

  it("未知 slug 404", async () => {
    const res = await likeApi.POST(
      new Request("http://localhost/api/posts/nope/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "v-x", action: "like" }),
      }),
      ctx("nope"),
    );
    expect(res.status).toBe(404);
  });

  it("每访客每天限 50 次", async () => {
    for (let i = 0; i < 50; i++) await like("v-limit", "like");
    const over = await like("v-limit", "like");
    expect(over.status).toBe(429);
  });
});

describe("GET /api/posts/[slug]/like", () => {
  it("游客与登录用户混合：计数含全部，头像列表只收登录的", async () => {
    await like("v-guest-1", "like");
    await like("v-guest-2", "like");
    sessionState.userId = 1;
    await like("v-user", "like");
    const state = await getLikes("v-guest-1");
    expect(state.likes).toBe(3);
    expect(state.likers).toHaveLength(1);
    expect(state.likers[0]!.login).toBe("alice");
    expect((await getLikes("v-guest-2")).liked).toBe(true);
    expect((await getLikes("v-stranger")).liked).toBe(false);
  });
});
