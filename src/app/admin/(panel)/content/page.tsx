import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts, projectPosts, projects, series } from "@/lib/db/schema";
import { ContentManager } from "@/components/admin/ContentManager";
import { LAB_DEMOS } from "@/lib/lab/catalog";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const [seriesRows, postRows, projectRows, relationRows] = await Promise.all([
    // 只取编辑表单需要的列：整行会带 createdAt/updatedAt，进草稿后会被服务端 .strict() 校验拒掉
    db
      .select({
        id: series.id,
        title: series.title,
        slug: series.slug,
        description: series.description,
        cover: series.cover,
        status: series.status,
        sort: series.sort,
      })
      .from(series)
      .orderBy(asc(series.sort), asc(series.id)),
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
    db
      .select({
        id: projects.id,
        title: projects.title,
        slug: projects.slug,
        summary: projects.summary,
        content: projects.content,
        cover: projects.cover,
        status: projects.status,
        stage: projects.stage,
        techStack: projects.techStack,
        repoUrl: projects.repoUrl,
        demoUrl: projects.demoUrl,
        labSlug: projects.labSlug,
        sort: projects.sort,
        startedAt: projects.startedAt,
      })
      .from(projects)
      .orderBy(asc(projects.sort), asc(projects.id)),
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
