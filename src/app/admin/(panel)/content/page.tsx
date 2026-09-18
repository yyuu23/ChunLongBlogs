import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts, projectPosts, projects, series } from "@/lib/db/schema";
import { ContentManager } from "@/components/admin/ContentManager";
import { LAB_DEMOS } from "@/lib/lab/catalog";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const [seriesRows, postRows, projectRows, relationRows] = await Promise.all([
    db.select().from(series).orderBy(asc(series.sort), asc(series.id)),
    db
      .select({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        seriesId: posts.seriesId,
        seriesOrder: posts.seriesOrder,
        difficulty: posts.difficulty,
      })
      .from(posts)
      .orderBy(asc(posts.createdAt)),
    db.select().from(projects).orderBy(asc(projects.sort), asc(projects.id)),
    db.select().from(projectPosts).orderBy(asc(projectPosts.sort)),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-2 text-xl font-bold">系列与项目</h1>
      <p className="mb-6 text-sm text-slate-500">
        系列是有阅读顺序的逻辑目录；AI 只生成预览，确认应用前不会修改文章归属。
      </p>
      <ContentManager
        seriesRows={seriesRows}
        posts={postRows}
        projects={projectRows.map((project) => ({
          ...project,
          techStack: (() => {
            try {
              const parsed = JSON.parse(project.techStack) as unknown;
              return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
            } catch {
              return [];
            }
          })(),
          postIds: relationRows.filter((relation) => relation.projectId === project.id).map((relation) => relation.postId),
        }))}
        labDemos={LAB_DEMOS.map((demo) => ({ slug: demo.slug, label: `${demo.emoji} ${demo.name.zh}` }))}
      />
    </div>
  );
}
