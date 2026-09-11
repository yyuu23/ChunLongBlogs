import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { comments, githubUsers, moments, posts } from "@/lib/db/schema";
import { CommentsManager, type AdminCommentItem } from "@/components/admin/CommentsManager";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 评论管理：GitHub 登录访客在文章/说说下的评论（含已软删的，便于恢复） */
export default async function AdminCommentsPage() {
  const rows = await db
    .select({
      id: comments.id,
      refType: comments.refType,
      refId: comments.refId,
      content: comments.content,
      ip: comments.ip,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt,
      login: githubUsers.login,
      avatarUrl: githubUsers.avatarUrl,
    })
    .from(comments)
    .innerJoin(githubUsers, eq(comments.githubUserId, githubUsers.id))
    .orderBy(desc(comments.id))
    .limit(300);

  // 批量取评论目标的标题（文章）或内容摘要（说说），避免逐条 N+1
  const postIds = [...new Set(rows.filter((r) => r.refType === "post").map((r) => r.refId))];
  const momentIds = [...new Set(rows.filter((r) => r.refType === "moment").map((r) => r.refId))];
  const [postRows, momentRows] = await Promise.all([
    postIds.length
      ? db.select({ id: posts.id, title: posts.title, slug: posts.slug }).from(posts).where(inArray(posts.id, postIds))
      : Promise.resolve([]),
    momentIds.length
      ? db.select({ id: moments.id, content: moments.content }).from(moments).where(inArray(moments.id, momentIds))
      : Promise.resolve([]),
  ]);
  const postMap = new Map(postRows.map((p) => [p.id, p]));
  const momentMap = new Map(momentRows.map((m) => [m.id, m]));

  const items: AdminCommentItem[] = rows.map((r) => {
    const post = r.refType === "post" ? postMap.get(r.refId) : undefined;
    const moment = r.refType === "moment" ? momentMap.get(r.refId) : undefined;
    return {
      id: r.id,
      refType: r.refType,
      refId: r.refId,
      content: r.content,
      ip: r.ip,
      login: r.login,
      avatarUrl: r.avatarUrl,
      date: formatDateTime(r.createdAt),
      deleted: r.deletedAt != null,
      targetTitle: post ? post.title : moment ? moment.content.slice(0, 30) : `#${r.refId}`,
      targetHref: post ? `/posts/${post.slug}` : moment ? `/moments#moment-${moment.id}` : null,
    };
  });

  return (
    <div>
      <h1 className="mx-auto mb-2 max-w-4xl text-xl font-bold">评论管理</h1>
      <p className="mx-auto mb-6 max-w-4xl text-xs text-slate-500">
        GitHub 登录访客在文章与说说下的评论。删除为软删除（前台不再显示原文，挂有回复的显示"已删除"占位，可恢复）。
        最多显示最近 300 条。
      </p>
      <CommentsManager items={items} />
    </div>
  );
}
