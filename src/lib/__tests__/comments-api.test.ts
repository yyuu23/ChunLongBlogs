import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

/**
 * /api/comments 集成测试（临时库）。
 * 核心回归点：
 *   1) 未登录 401；登录后可发（文章/说说），无效 refType 400、目标不存在 404；
 *   2) 内容清洗：trim、控制字符剔除、1000 字截断、空内容 400；
 *   3) 一层回复：parentId 落库、GET 树形嵌套、replyTo 带父评论登录名；
 *   4) 软删除：作者可删自己的（别人的 404）；带回复的显示占位、叶子直接消失；
 *   5) 同 IP 限流：10 分钟 3 次、每日 10 次。
 * getUserSession 读 next/headers cookies，node 环境无请求上下文 → mock 掉。
 */

const sessionState = vi.hoisted(() => ({ userId: null as number | null }));
vi.mock("@/lib/authUser", () => ({
  getUserSession: async () => (sessionState.userId ? { userId: sessionState.userId } : null),
}));

let api: typeof import("@/app/api/comments/route");
let raw: Database.Database;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "cl-comments-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  raw = new Database(process.env.DATABASE_PATH);
  raw.exec(`CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft'
  )`);
  raw.exec(`CREATE TABLE moments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL
  )`);
  raw.exec(`CREATE TABLE github_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id INTEGER NOT NULL UNIQUE,
    login TEXT NOT NULL,
    avatar_url TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);
  raw.exec(`CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_type TEXT NOT NULL,
    ref_id INTEGER NOT NULL,
    github_user_id INTEGER NOT NULL,
    parent_id INTEGER,
    content TEXT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    deleted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);
  raw.prepare("INSERT INTO posts (slug, status) VALUES ('p1', 'published')").run();
  raw.prepare("INSERT INTO moments (content) VALUES ('第一条说说')").run();
  raw.prepare("INSERT INTO github_users (github_id, login, avatar_url) VALUES (1, 'alice', 'https://a/1.png')").run();
  raw.prepare("INSERT INTO github_users (github_id, login, avatar_url) VALUES (2, 'bob', 'https://a/2.png')").run();

  api = await import("@/app/api/comments/route");
});

const post = (body: Record<string, unknown>, ip: string) =>
  api.POST(
    new Request("http://localhost/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );

const getTree = async (refType: string, refId: number) =>
  (await (
    await api.GET(new Request(`http://localhost/api/comments?refType=${refType}&refId=${refId}`))
  ).json()) as {
    comments: {
      id: number;
      content: string;
      deleted: boolean;
      author: { login: string } | null;
      replyTo: string | null;
      replies: unknown[];
    }[];
  };

const POST_ID = 1;
const MOMENT_ID = 1;

describe("POST /api/comments", () => {
  it("未登录 401", async () => {
    sessionState.userId = null;
    const res = await post({ refType: "post", refId: POST_ID, content: "hi" }, "1.1.1.1");
    expect(res.status).toBe(401);
  });

  it("登录后发文章评论成功，返回 DTO 带作者", async () => {
    sessionState.userId = 1;
    const res = await post({ refType: "post", refId: POST_ID, content: "好文！".repeat(1) }, "1.1.1.2");
    expect(res.status).toBe(200);
    const d = (await res.json()) as { comment: { author: { login: string }; content: string } };
    expect(d.comment.author.login).toBe("alice");
    expect(d.comment.content).toBe("好文！");
  });

  it("说说评论成功（refType=moment）", async () => {
    sessionState.userId = 2;
    const res = await post({ refType: "moment", refId: MOMENT_ID, content: "路过" }, "1.1.1.3");
    expect(res.status).toBe(200);
  });

  it("无效 refType 400 / 目标不存在 404 / 空内容 400", async () => {
    sessionState.userId = 1;
    expect((await post({ refType: "album", refId: 1, content: "x" }, "1.1.1.4")).status).toBe(400);
    expect((await post({ refType: "post", refId: 999, content: "x" }, "1.1.1.4")).status).toBe(404);
    expect((await post({ refType: "post", refId: POST_ID, content: "   " }, "1.1.1.4")).status).toBe(400);
  });

  it("内容清洗：控制字符剔除、超长截断到 1000", async () => {
    sessionState.userId = 1;
    const res = await post(
      { refType: "post", refId: POST_ID, content: `a\u0000b${"x".repeat(1200)}` },
      "1.1.1.5",
    );
    expect(res.status).toBe(200);
    const d = (await res.json()) as { comment: { content: string } };
    expect(d.comment.content).toHaveLength(1000);
    expect(d.comment.content.startsWith("ab")).toBe(true);
  });

  it("回复必须落在同一目标下（跨目标 parentId 400）", async () => {
    sessionState.userId = 1;
    const top = (await getTree("post", POST_ID)).comments[0]!;
    const res = await post(
      { refType: "moment", refId: MOMENT_ID, parentId: top.id, content: "串楼" },
      "1.1.1.6",
    );
    expect(res.status).toBe(400);
  });

  it("同 IP 10 分钟内第 4 条被拒（滑动窗口限流）", async () => {
    sessionState.userId = 1;
    for (let i = 0; i < 3; i++) {
      const res = await post({ refType: "post", refId: POST_ID, content: `限流-${i}` }, "9.9.9.9");
      expect(res.status).toBe(200);
    }
    const fourth = await post({ refType: "post", refId: POST_ID, content: "第四条" }, "9.9.9.9");
    expect(fourth.status).toBe(429);
  });
});

describe("GET /api/comments", () => {
  it("树形嵌套：回复挂在父下并带 replyTo 登录名", async () => {
    // alice 已有一条顶层；bob 回复 alice（独立 IP 避开上面的限流桶）
    sessionState.userId = 2;
    const tree0 = (await getTree("post", POST_ID)).comments;
    const aliceTop = tree0.find((c) => c.author?.login === "alice" && c.replies.length === 0)!;
    const res = await post(
      { refType: "post", refId: POST_ID, parentId: aliceTop.id, content: "回复你" },
      "8.8.8.8",
    );
    expect(res.status).toBe(200);

    const tree = (await getTree("post", POST_ID)).comments;
    const parent = tree.find((c) => c.id === aliceTop.id)!;
    expect(parent.replies).toHaveLength(1);
    const reply = parent.replies[0] as { replyTo: string | null; author: { login: string } };
    expect(reply.replyTo).toBe("alice");
    expect(reply.author.login).toBe("bob");
  });
});

describe("DELETE /api/comments", () => {
  it("只能删自己的（别人的 404）；带回复的删后显示占位，叶子删除后消失", async () => {
    // bob 试图删 alice 的顶层评论
    sessionState.userId = 2;
    const tree = (await getTree("post", POST_ID)).comments;
    const aliceTop = tree.find((c) => c.author?.login === "alice")!;
    const notYours = await api.DELETE(
      new Request(`http://localhost/api/comments?id=${aliceTop.id}`),
    );
    expect(notYours.status).toBe(404);

    // alice 删自己的（该评论挂着 bob 的回复 → 前台显示占位）
    sessionState.userId = 1;
    const mine = await api.DELETE(new Request(`http://localhost/api/comments?id=${aliceTop.id}`));
    expect(mine.status).toBe(200);
    const after = (await getTree("post", POST_ID)).comments;
    const placeholder = after.find((c) => c.id === aliceTop.id);
    expect(placeholder?.deleted).toBe(true);
    expect(placeholder?.content).toBe("");
    expect(placeholder?.replies.length).toBeGreaterThan(0); // 回复线保住了

    // alice 删自己另一条叶子评论 → 整条消失
    const leaf = after.find((c) => c.author?.login === "alice" && c.id !== aliceTop.id)!;
    const delLeaf = await api.DELETE(new Request(`http://localhost/api/comments?id=${leaf.id}`));
    expect(delLeaf.status).toBe(200);
    const final = (await getTree("post", POST_ID)).comments;
    expect(final.find((c) => c.id === leaf.id)).toBeUndefined();
  });
});
