import Link from "next/link";
import { desc, eq, isNull, sql } from "drizzle-orm";
import {
  FileText,
  Eye,
  PenLine,
  FileEdit,
  MessageCircleHeart,
  MessageSquareText,
  Heart,
  Users,
  Images,
  Plus,
} from "lucide-react";
import { db } from "@/lib/db";
import { albums, comments, friendLinks, githubUsers, moments, photos, posts } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [postStats] = await db
    .select({
      published: sql<number>`count(*) FILTER (WHERE status = 'published')`,
      drafts: sql<number>`count(*) FILTER (WHERE status = 'draft')`,
      views: sql<number>`coalesce(sum(views), 0)`,
      words: sql<number>`coalesce(sum(word_count), 0)`,
    })
    .from(posts);
  const [momentCount] = await db.select({ n: sql<number>`count(*)` }).from(moments);
  const [friendCount] = await db.select({ n: sql<number>`count(*)` }).from(friendLinks);
  const [albumCount] = await db.select({ n: sql<number>`count(*)` }).from(albums);
  const [photoCount] = await db.select({ n: sql<number>`count(*)` }).from(photos);
  /* 互动统计：点赞总数（反范式计数合计）、评论（有效/已删分开数）、GitHub 登录用户 */
  const [likeTotal] = await db.select({ n: sql<number>`coalesce(sum(likes), 0)` }).from(posts);
  const [commentStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) FILTER (WHERE deleted_at IS NULL)`,
    })
    .from(comments);
  const [githubUserCount] = await db.select({ n: sql<number>`count(*)` }).from(githubUsers);
  const recentComments = await db
    .select({
      id: comments.id,
      content: comments.content,
      refType: comments.refType,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      login: githubUsers.login,
    })
    .from(comments)
    .innerJoin(githubUsers, eq(comments.githubUserId, githubUsers.id))
    .where(isNull(comments.deletedAt))
    .orderBy(desc(comments.id))
    .limit(5);
  const recent = await db
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      views: posts.views,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .orderBy(desc(posts.updatedAt))
    .limit(6);

  const cards = [
    { label: "已发布", value: postStats.published, sub: `草稿 ${postStats.drafts}`, icon: FileText, color: "from-indigo-500 to-purple-500" },
    { label: "总阅读", value: postStats.views, sub: "次", icon: Eye, color: "from-sky-500 to-cyan-400" },
    { label: "总点赞", value: Number(likeTotal?.n ?? 0), sub: "次", icon: Heart, color: "from-rose-500 to-pink-400" },
    { label: "总字数", value: postStats.words, sub: "字", icon: PenLine, color: "from-emerald-500 to-teal-400" },
    { label: "评论", value: Number(commentStats?.total ?? 0), sub: `有效 ${Number(commentStats?.active ?? 0)} · 已删 ${Number(commentStats?.total ?? 0) - Number(commentStats?.active ?? 0)}`, icon: MessageSquareText, color: "from-amber-500 to-orange-400" },
    { label: "GitHub 用户", value: Number(githubUserCount?.n ?? 0), sub: "位登录访客", icon: Users, color: "from-violet-500 to-fuchsia-400" },
    { label: "内容数", value: momentCount.n + friendCount.n + albumCount.n, sub: `说说 ${momentCount.n} · 友链 ${friendCount.n} · 相册 ${albumCount.n}（${photoCount.n} 图）`, icon: Images, color: "from-pink-500 to-rose-400" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">仪表盘</h1>
        <Link
          href="/admin/posts/new"
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          写文章
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div
                className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-white`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-2xl font-bold">{c.value.toLocaleString()}</p>
              <p className="text-xs text-slate-500">
                {c.label} · {c.sub}
              </p>
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <FileEdit className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold">最近编辑</h2>
        </div>
        {recent.length ? (
          <ul className="divide-y divide-slate-100">
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/posts/${p.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                      p.status === "published"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {p.status === "published" ? "已发布" : "草稿"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">
                    {p.views} 阅读
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDateTime(p.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-400">还没有文章，点击右上角「写文章」开始创作</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold">最近评论</h2>
          </div>
          <Link href="/admin/comments" className="text-xs text-indigo-500 hover:underline">
            全部评论 →
          </Link>
        </div>
        {recentComments.length ? (
          <ul className="divide-y divide-slate-100">
            {recentComments.map((c) => (
              <li key={c.id}>
                <Link
                  href="/admin/comments"
                  className="flex items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50"
                >
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    {c.login}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.content}</span>
                  <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">
                    {c.refType === "post" ? "文章" : "说说"}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDateTime(c.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            还没有评论——配置 GitHub OAuth（见 .env.example）后，访客登录即可评论
          </p>
        )}
      </section>
    </div>
  );
}
