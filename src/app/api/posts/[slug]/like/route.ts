import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { githubUsers, postLikes, posts } from "@/lib/db/schema";
import { dailyCount } from "@/lib/rateLimit";
import { getUserSession } from "@/lib/authUser";
import { incrStat } from "@/lib/stats";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function findPost(slug: string) {
  const [post] = await db
    .select({ id: posts.id, likes: posts.likes })
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")))
    .limit(1);
  return post ?? null;
}

/** GET /api/posts/[slug]/like?visitorId= —— 点赞数 + 当前访客是否已赞 + 头像列表 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await findPost(slug);
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const visitorId = (searchParams.get("visitorId") ?? "").trim().slice(0, 64);

  const [likedRow] = visitorId
    ? await db
        .select({ id: postLikes.id })
        .from(postLikes)
        .where(and(eq(postLikes.postId, post.id), eq(postLikes.visitorId, visitorId)))
        .limit(1)
    : [];

  // 头像列表只收登录用户的赞（游客的赞只进数字）——朋友圈式展示
  const likers = await db
    .select({ login: githubUsers.login, avatarUrl: githubUsers.avatarUrl })
    .from(postLikes)
    .innerJoin(githubUsers, eq(postLikes.githubUserId, githubUsers.id))
    .where(and(eq(postLikes.postId, post.id), isNotNull(postLikes.githubUserId)))
    .orderBy(desc(postLikes.createdAt))
    .limit(15);

  return NextResponse.json({
    likes: post.likes,
    liked: Boolean(likedRow),
    likers,
  });
}

/**
 * POST /api/posts/[slug]/like —— body: { visitorId, action: "like" | "unlike" }。
 * 游客与登录用户都可点赞；unique(postId, visitorId) 天然一人一赞（幂等），
 * 登录用户的赞带 githubUserId 进头像列表。每访客每天最多 50 次（防脚本刷）。
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await request.json().catch(() => null)) as { visitorId?: string; action?: string } | null;
  const visitorId = (body?.visitorId ?? "").trim().slice(0, 64);
  const action = body?.action === "unlike" ? "unlike" : "like";
  if (!visitorId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const post = await findPost(slug);
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!dailyCount(`like:${visitorId}`, 50).ok) {
    return NextResponse.json({ error: "too many likes today" }, { status: 429 });
  }

  const session = await getUserSession();

  try {
    const changed = db.$client.transaction(() => {
      if (action === "like") {
        const res = db
          .insert(postLikes)
          .values({ postId: post.id, visitorId, githubUserId: session?.userId ?? null })
          .onConflictDoNothing()
          .run();
        if (res.changes > 0) {
          db.update(posts)
            .set({ likes: sql`${posts.likes} + 1` })
            .where(eq(posts.id, post.id))
            .run();
        }
        return res.changes > 0;
      }
      const res = db
        .delete(postLikes)
        .where(and(eq(postLikes.postId, post.id), eq(postLikes.visitorId, visitorId)))
        .run();
      if (res.changes > 0) {
        // max(0, ...) 兜底：反范式计数与流水极端情况下漂移时不出现负数
        db.update(posts)
          .set({ likes: sql`max(0, ${posts.likes} - 1)` })
          .where(eq(posts.id, post.id))
          .run();
      }
      return res.changes > 0;
    })();

    if (changed && action === "like") {
      void incrStat("like", slug);
    }
  } catch (err) {
    logError("posts/like", err, { slug });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  const fresh = await findPost(slug);
  return NextResponse.json({
    ok: true,
    likes: fresh?.likes ?? post.likes,
    liked: action === "like",
  });
}
