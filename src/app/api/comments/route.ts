import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { comments, githubUsers, moments, posts } from "@/lib/db/schema";
import { getUserSession } from "@/lib/authUser";
import { clientIp, rateLimit, dailyCount } from "@/lib/rateLimit";
import { incrStat } from "@/lib/stats";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const REF_TYPES = ["post", "moment"] as const;
type RefType = (typeof REF_TYPES)[number];

function parseRefType(value: unknown): RefType | null {
  const s = String(value ?? "");
  return (REF_TYPES as readonly string[]).includes(s) ? (s as RefType) : null;
}

/** 评论目标必须真实存在且可见（文章仅 published；说说无草稿态） */
async function targetExists(refType: RefType, refId: number): Promise<boolean> {
  if (refType === "post") {
    const [row] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, refId), eq(posts.status, "published")))
      .limit(1);
    return Boolean(row);
  }
  const [row] = await db.select({ id: moments.id }).from(moments).where(eq(moments.id, refId)).limit(1);
  return Boolean(row);
}

export interface CommentDto {
  id: number;
  content: string;
  deleted: boolean;
  createdAt: number;
  author: { id: number; login: string; avatarUrl: string } | null;
  /** 回复目标的登录名（一层回复，@某人 用） */
  replyTo: string | null;
  replies: CommentDto[];
}

interface CommentRow {
  id: number;
  parentId: number | null;
  content: string;
  deletedAt: Date | null;
  createdAt: Date;
  userId: number;
  login: string;
  avatarUrl: string;
}

/** 拉全量后内存组树：一层回复，量级（单页评论 < 几百）下比递归查询简单且够快 */
function buildTree(rows: CommentRow[]): CommentDto[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const children = new Map<number, CommentRow[]>();
  const tops: CommentRow[] = [];
  for (const r of rows) {
    if (r.parentId && byId.has(r.parentId)) {
      const list = children.get(r.parentId) ?? [];
      list.push(r);
      children.set(r.parentId, list);
    } else {
      tops.push(r); // 无父 / 父已被物理删除（cascade 会连带删子，理论到不了这里，兜底成顶层）
    }
  }
  const toDto = (r: CommentRow): CommentDto => ({
    id: r.id,
    content: r.deletedAt ? "" : r.content,
    deleted: Boolean(r.deletedAt),
    createdAt: r.createdAt.getTime(),
    author: { id: r.userId, login: r.login, avatarUrl: r.avatarUrl },
    replyTo: r.parentId ? (byId.get(r.parentId)?.login ?? null) : null,
    replies: (children.get(r.id) ?? []).map(toDto),
  });
  return pruneDeleted(tops.map(toDto));
}

/** 剪枝：软删的叶子整条隐藏；只有还挂着回复的才保留"已删除"占位（保住对话线） */
function pruneDeleted(dtos: CommentDto[]): CommentDto[] {
  const out: CommentDto[] = [];
  for (const d of dtos) {
    d.replies = pruneDeleted(d.replies);
    if (!d.deleted || d.replies.length > 0) out.push(d);
  }
  return out;
}

/** GET /api/comments?refType=post&refId=1 —— 评论区（含软删占位，保住回复线） */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refType = parseRefType(searchParams.get("refType"));
  const refId = Number(searchParams.get("refId"));
  if (!refType || !Number.isInteger(refId) || refId <= 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      content: comments.content,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt,
      userId: githubUsers.id,
      login: githubUsers.login,
      avatarUrl: githubUsers.avatarUrl,
    })
    .from(comments)
    .innerJoin(githubUsers, eq(comments.githubUserId, githubUsers.id))
    .where(and(eq(comments.refType, refType), eq(comments.refId, refId)))
    .orderBy(asc(comments.createdAt));

  return NextResponse.json({ comments: buildTree(rows) });
}

/** POST /api/comments —— body: { refType, refId, parentId?, content }（必须 GitHub 登录） */
export async function POST(request: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录 GitHub" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    refType?: string;
    refId?: number;
    parentId?: number;
    content?: string;
  } | null;
  const refType = parseRefType(body?.refType);
  const refId = Number(body?.refId);
  const parentId = Number(body?.parentId);
  const content = String(body?.content ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // 控制字符（保留 \t \n \r）
    .trim()
    .slice(0, 1000);
  if (!refType || !Number.isInteger(refId) || refId <= 0 || !content) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const ip = clientIp(request);
  if (!rateLimit(`comment:${ip}`, 3, 10 * 60_000).ok) {
    return NextResponse.json({ error: "评论太快啦，休息一下" }, { status: 429 });
  }
  if (!dailyCount(`comment:${ip}`, 10).ok) {
    return NextResponse.json({ error: "今天评论得够多啦，明天再来" }, { status: 429 });
  }

  if (!(await targetExists(refType, refId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // 回复必须落在同一目标下，防止跨文章串楼
  if (Number.isInteger(parentId) && parentId > 0) {
    const [parent] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.id, parentId), eq(comments.refType, refType), eq(comments.refId, refId)))
      .limit(1);
    if (!parent) return NextResponse.json({ error: "invalid parent" }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(comments)
      .values({
        refType,
        refId,
        githubUserId: session.userId,
        parentId: Number.isInteger(parentId) && parentId > 0 ? parentId : null,
        content,
        ip,
      })
      .returning({ id: comments.id, createdAt: comments.createdAt });

    void incrStat("comment", `${refType}:${refId}`);

    const [user] = await db
      .select({ id: githubUsers.id, login: githubUsers.login, avatarUrl: githubUsers.avatarUrl })
      .from(githubUsers)
      .where(eq(githubUsers.id, session.userId))
      .limit(1);

    const dto: CommentDto = {
      id: row.id,
      content,
      deleted: false,
      createdAt: row.createdAt.getTime(),
      author: user ?? null,
      replyTo: null,
      replies: [],
    };
    return NextResponse.json({ ok: true, comment: dto });
  } catch (err) {
    logError("comments/post", err, { refType, refId });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/** DELETE /api/comments?id= —— 作者删除自己的评论（软删除；admin 可在后台恢复） */
export async function DELETE(request: Request) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const updated = await db
    .update(comments)
    .set({ deletedAt: new Date() })
    // 只能删自己的；软删除（admin 后台可恢复）
    .where(and(eq(comments.id, id), eq(comments.githubUserId, session.userId)))
    .returning({ id: comments.id });
  if (!updated.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
