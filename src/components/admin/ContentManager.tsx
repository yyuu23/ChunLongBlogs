"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  applySeriesProposal,
  assignSeriesPosts,
  deleteProject,
  deleteSeries,
  saveProject,
  saveSeries,
  suggestSeriesOrganization,
} from "@/app/admin/actions/content";
import type { SeriesProposal } from "@/lib/content/types";

type SeriesRow = {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover: string;
  status: "draft" | "published";
  sort: number;
};

type PostRow = {
  id: number;
  title: string;
  status: "draft" | "published" | "scheduled";
  seriesId: number | null;
  seriesOrder: number;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
};

type ProjectRow = {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  cover: string;
  status: "draft" | "published";
  stage: "planned" | "in_progress" | "maintaining" | "completed" | "archived";
  techStack: string[];
  repoUrl: string;
  demoUrl: string;
  labSlug: string | null;
  sort: number;
  startedAt: Date | null;
  postIds: number[];
};

type SeriesDraft = Omit<SeriesRow, "id"> & { id?: number };
type ProjectDraft = Omit<ProjectRow, "id" | "startedAt"> & { id?: number; startedAt: string };

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400";

const blankSeries = (): SeriesDraft => ({
  title: "",
  slug: "",
  description: "",
  cover: "",
  status: "draft",
  sort: 0,
});

const blankProject = (): ProjectDraft => ({
  title: "",
  slug: "",
  summary: "",
  content: "",
  cover: "",
  status: "draft",
  stage: "in_progress",
  techStack: [],
  repoUrl: "",
  demoUrl: "",
  labSlug: null,
  sort: 0,
  startedAt: "",
  postIds: [],
});

export function ContentManager({
  seriesRows,
  posts,
  projects,
  labDemos,
}: {
  seriesRows: SeriesRow[];
  posts: PostRow[];
  projects: ProjectRow[];
  labDemos: Array<{ slug: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"series" | "projects">("series");
  const [message, setMessage] = useState("");
  const [seriesDraft, setSeriesDraft] = useState<SeriesDraft>(blankSeries);
  const [seriesPostIds, setSeriesPostIds] = useState<number[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [proposal, setProposal] = useState<SeriesProposal | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(blankProject);
  const [stackInput, setStackInput] = useState("");

  const postById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);

  const editSeries = (item: SeriesRow) => {
    setSeriesDraft(item);
    setSeriesPostIds(
      posts
        .filter((post) => post.seriesId === item.id)
        .sort((a, b) => a.seriesOrder - b.seriesOrder)
        .map((post) => post.id),
    );
    setMessage("");
  };

  const moveSeriesPost = (postId: number, delta: number) => {
    setSeriesPostIds((current) => {
      const index = current.indexOf(postId);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[next]] = [copy[next]!, copy[index]!];
      return copy;
    });
  };

  const saveSeriesDraft = () => {
    setMessage("");
    startTransition(async () => {
      const result = await saveSeries(seriesDraft);
      if (!("ok" in result) || !result.ok || !result.id) {
        setMessage(result.error ?? "系列保存失败");
        return;
      }
      const assigned = await assignSeriesPosts(
        result.id,
        seriesPostIds.map((postId, index) => ({ postId, order: index + 1 })),
      );
      if (!("ok" in assigned)) {
        setMessage(assigned.error);
        return;
      }
      setMessage("系列已保存");
      setSeriesDraft(blankSeries());
      setSeriesPostIds([]);
      router.refresh();
    });
  };

  const runAiOrganize = () => {
    setMessage("");
    startTransition(async () => {
      const result = await suggestSeriesOrganization();
      if (!("ok" in result)) {
        setMessage(result.error);
        return;
      }
      setProposal(result.proposal);
    });
  };

  const updateProposalGroup = (index: number, update: SeriesProposal["groups"][number]) => {
    setProposal((current) =>
      current ? { ...current, groups: current.groups.map((group, i) => (i === index ? update : group)) } : current,
    );
  };

  const applyProposal = () => {
    if (!proposal) return;
    setMessage("");
    startTransition(async () => {
      const result = await applySeriesProposal(proposal);
      if (!("ok" in result)) {
        setMessage(result.error);
        return;
      }
      setProposal(null);
      setMessage("AI 整理方案已应用；新系列默认保存为草稿，请检查后发布");
      router.refresh();
    });
  };

  const editProject = (item: ProjectRow) => {
    setProjectDraft({
      ...item,
      startedAt: item.startedAt ? item.startedAt.toISOString() : "",
    });
    setStackInput("");
    setMessage("");
  };

  const saveProjectDraft = () => {
    setMessage("");
    startTransition(async () => {
      const result = await saveProject({
        ...projectDraft,
        startedAt: projectDraft.startedAt || null,
      });
      if (!("ok" in result)) {
        setMessage(result.error);
        return;
      }
      setProjectDraft(blankProject());
      setMessage("项目已保存");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(["series", "projects"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-lg px-4 py-2 text-sm ${tab === value ? "bg-indigo-50 font-medium text-indigo-600" : "text-slate-500"}`}
            >
              {value === "series" ? "文章系列" : "项目作品"}
            </button>
          ))}
        </div>
        {message && <p className="text-sm text-slate-500">{message}</p>}
      </div>

      {tab === "series" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">系列列表（{seriesRows.length}）</h2>
              <button
                type="button"
                onClick={runAiOrganize}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-600 disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI 整理全部文章
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {seriesRows.map((item) => {
                const count = posts.filter((post) => post.seriesId === item.id).length;
                return (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${item.status === "published" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {item.status === "published" ? "已发布" : "草稿"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs text-slate-400">/{item.slug} · {count} 篇</p>
                    </div>
                    <button type="button" onClick={() => editSeries(item)} className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500" title="编辑">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`删除系列「${item.title}」？文章只会解除关联，不会被删除。`)) return;
                        startTransition(async () => {
                          await deleteSeries(item.id);
                          router.refresh();
                        });
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
              {!seriesRows.length && <li className="px-5 py-8 text-center text-sm text-slate-400">还没有系列</li>}
            </ul>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{seriesDraft.id ? "编辑系列" : "新建系列"}</h2>
              {seriesDraft.id && (
                <button type="button" onClick={() => { setSeriesDraft(blankSeries()); setSeriesPostIds([]); }} className="text-xs text-slate-400 hover:text-slate-600">
                  取消编辑
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-500">标题<input className={input} value={seriesDraft.title} onChange={(e) => setSeriesDraft({ ...seriesDraft, title: e.target.value })} /></label>
              <label className="space-y-1 text-xs text-slate-500">slug<input className={input} value={seriesDraft.slug} onChange={(e) => setSeriesDraft({ ...seriesDraft, slug: e.target.value })} placeholder="留空自动生成" /></label>
              <label className="space-y-1 text-xs text-slate-500 sm:col-span-2">简介<textarea className={`${input} resize-y`} rows={3} value={seriesDraft.description} onChange={(e) => setSeriesDraft({ ...seriesDraft, description: e.target.value })} /></label>
              <label className="space-y-1 text-xs text-slate-500 sm:col-span-2">封面<input className={input} value={seriesDraft.cover} onChange={(e) => setSeriesDraft({ ...seriesDraft, cover: e.target.value })} /></label>
              <label className="space-y-1 text-xs text-slate-500">状态<select className={input} value={seriesDraft.status} onChange={(e) => setSeriesDraft({ ...seriesDraft, status: e.target.value as SeriesDraft["status"] })}><option value="draft">草稿</option><option value="published">发布</option></select></label>
              <label className="space-y-1 text-xs text-slate-500">排序<input className={input} type="number" min={0} value={seriesDraft.sort} onChange={(e) => setSeriesDraft({ ...seriesDraft, sort: Number(e.target.value) || 0 })} /></label>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">系列文章与顺序</p>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {seriesPostIds.map((postId, index) => {
                  const post = postById.get(postId);
                  if (!post) return null;
                  return (
                    <div
                      key={postId}
                      draggable
                      onDragStart={() => setDragId(postId)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (dragId == null || dragId === postId) return;
                        setSeriesPostIds((current) => {
                          const next = current.filter((id) => id !== dragId);
                          next.splice(next.indexOf(postId), 0, dragId);
                          return next;
                        });
                        setDragId(null);
                      }}
                      className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2 text-xs"
                    >
                      <GripVertical className="h-3.5 w-3.5 cursor-grab text-slate-300" />
                      <span className="w-5 text-center text-slate-400">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{post.title}</span>
                      <button type="button" onClick={() => moveSeriesPost(postId, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveSeriesPost(postId, 1)} disabled={index === seriesPostIds.length - 1}><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setSeriesPostIds((ids) => ids.filter((id) => id !== postId))}><X className="h-3.5 w-3.5 text-rose-400" /></button>
                    </div>
                  );
                })}
                {!seriesPostIds.length && <p className="py-3 text-center text-xs text-slate-400">从下方文章列表添加</p>}
              </div>
              <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {posts.filter((post) => !seriesPostIds.includes(post.id)).map((post) => (
                  <button key={post.id} type="button" onClick={() => setSeriesPostIds((ids) => [...ids, post.id])} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-500 hover:bg-indigo-50 hover:text-indigo-600">
                    <Plus className="h-3 w-3" /><span className="truncate">{post.title}</span>{post.seriesId && <span className="ml-auto shrink-0 text-[10px] text-amber-500">已有系列</span>}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={saveSeriesDraft} disabled={pending || !seriesDraft.title.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} 保存系列
            </button>
          </section>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(24rem,1.2fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold">项目列表（{projects.length}）</h2></div>
            <ul className="divide-y divide-slate-100">
              {projects.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${item.status === "published" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{item.status === "published" ? "已发布" : "草稿"}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-xs text-slate-400">{({ planned: "计划中", in_progress: "进行中", maintaining: "维护中", completed: "已完成", archived: "已归档" } as const)[item.stage]} · {item.postIds.length} 篇文章 · {item.labSlug ? "已关联实验" : "无实验"}</p></div>
                  <button type="button" onClick={() => editProject(item)} className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => { if (confirm(`删除项目「${item.title}」？`)) startTransition(async () => { await deleteProject(item.id); router.refresh(); }); }} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
              {!projects.length && <li className="px-5 py-8 text-center text-sm text-slate-400">还没有项目案例</li>}
            </ul>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{projectDraft.id ? "编辑项目" : "新建项目"}</h2>{projectDraft.id && <button type="button" onClick={() => setProjectDraft(blankProject())} className="text-xs text-slate-400">取消编辑</button>}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-500">标题<input className={input} value={projectDraft.title} onChange={(e) => setProjectDraft({ ...projectDraft, title: e.target.value })} /></label>
              <label className="space-y-1 text-xs text-slate-500">slug<input className={input} value={projectDraft.slug} onChange={(e) => setProjectDraft({ ...projectDraft, slug: e.target.value })} placeholder="留空自动生成" /></label>
              <label className="space-y-1 text-xs text-slate-500 sm:col-span-2">摘要<textarea className={`${input} resize-y`} rows={2} value={projectDraft.summary} onChange={(e) => setProjectDraft({ ...projectDraft, summary: e.target.value })} /></label>
              <label className="space-y-1 text-xs text-slate-500 sm:col-span-2">项目复盘（Markdown）<textarea className={`${input} resize-y font-mono text-xs`} rows={10} value={projectDraft.content} onChange={(e) => setProjectDraft({ ...projectDraft, content: e.target.value })} /></label>
              <label className="space-y-1 text-xs text-slate-500 sm:col-span-2">封面<input className={input} value={projectDraft.cover} onChange={(e) => setProjectDraft({ ...projectDraft, cover: e.target.value })} /></label>
              <label className="space-y-1 text-xs text-slate-500">仓库地址<input className={input} value={projectDraft.repoUrl} onChange={(e) => setProjectDraft({ ...projectDraft, repoUrl: e.target.value })} /></label>
              <label className="space-y-1 text-xs text-slate-500">演示地址<input className={input} value={projectDraft.demoUrl} onChange={(e) => setProjectDraft({ ...projectDraft, demoUrl: e.target.value })} /></label>
              <label className="space-y-1 text-xs text-slate-500">关联实验<select className={input} value={projectDraft.labSlug ?? ""} onChange={(e) => setProjectDraft({ ...projectDraft, labSlug: e.target.value || null })}><option value="">不关联</option>{labDemos.map((demo) => <option key={demo.slug} value={demo.slug}>{demo.label}</option>)}</select></label>
              <label className="space-y-1 text-xs text-slate-500">开始时间<input type="date" className={input} value={projectDraft.startedAt.slice(0, 10)} onChange={(e) => setProjectDraft({ ...projectDraft, startedAt: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : "" })} /></label>
              <label className="space-y-1 text-xs text-slate-500">状态<select className={input} value={projectDraft.status} onChange={(e) => setProjectDraft({ ...projectDraft, status: e.target.value as ProjectDraft["status"] })}><option value="draft">草稿</option><option value="published">发布</option></select></label>
              <label className="space-y-1 text-xs text-slate-500">项目阶段<select className={input} value={projectDraft.stage} onChange={(e) => setProjectDraft({ ...projectDraft, stage: e.target.value as ProjectDraft["stage"] })}><option value="planned">计划中</option><option value="in_progress">进行中</option><option value="maintaining">维护中</option><option value="completed">已完成</option><option value="archived">已归档</option></select></label>
              <label className="space-y-1 text-xs text-slate-500">排序<input type="number" min={0} className={input} value={projectDraft.sort} onChange={(e) => setProjectDraft({ ...projectDraft, sort: Number(e.target.value) || 0 })} /></label>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">技术栈（回车添加）</p>
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 p-2">
                {projectDraft.techStack.map((item) => <span key={item} className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-600">{item}<button type="button" onClick={() => setProjectDraft({ ...projectDraft, techStack: projectDraft.techStack.filter((value) => value !== item) })}><X className="h-3 w-3" /></button></span>)}
                <input className="min-w-28 flex-1 bg-transparent text-xs outline-none" value={stackInput} onChange={(e) => setStackInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && stackInput.trim()) { e.preventDefault(); setProjectDraft({ ...projectDraft, techStack: [...new Set([...projectDraft.techStack, stackInput.trim()])] }); setStackInput(""); } }} placeholder="Next.js" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">关联文章</p>
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2">
                {posts.map((post) => <label key={post.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"><input type="checkbox" checked={projectDraft.postIds.includes(post.id)} onChange={(e) => setProjectDraft({ ...projectDraft, postIds: e.target.checked ? [...projectDraft.postIds, post.id] : projectDraft.postIds.filter((id) => id !== post.id) })} /><span className="truncate">{post.title}</span></label>)}
              </div>
            </div>
            <button type="button" onClick={saveProjectDraft} disabled={pending || !projectDraft.title.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} 保存项目</button>
          </section>
        </div>
      )}

      {proposal && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold text-slate-800">AI 系列整理预览</h2><p className="text-xs text-slate-500">可以删掉不合适的文章、调整顺序或修改新系列名称；应用前不会写数据库。</p></div>
            <button type="button" onClick={() => setProposal(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {proposal.groups.map((group, groupIndex) => {
              const existing = group.existingSeriesId ? seriesRows.find((item) => item.id === group.existingSeriesId) : null;
              return (
                <div key={`${group.existingSeriesId ?? group.newSeries?.slug}-${groupIndex}`} className="rounded-xl border border-indigo-100 bg-white p-4">
                  {group.newSeries ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className={input} value={group.newSeries.title} onChange={(e) => updateProposalGroup(groupIndex, { ...group, newSeries: { ...group.newSeries!, title: e.target.value } })} />
                      <input className={input} value={group.newSeries.slug} onChange={(e) => updateProposalGroup(groupIndex, { ...group, newSeries: { ...group.newSeries!, slug: e.target.value } })} />
                      <textarea className={`${input} sm:col-span-2`} rows={2} value={group.newSeries.description} onChange={(e) => updateProposalGroup(groupIndex, { ...group, newSeries: { ...group.newSeries!, description: e.target.value } })} />
                    </div>
                  ) : <h3 className="text-sm font-semibold">加入已有系列：{existing?.title ?? "未知系列"}</h3>}
                  <ol className="mt-3 space-y-2">
                    {group.items.map((item, itemIndex) => (
                      <li key={item.postId} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                        <span className="mt-0.5 w-5 text-center text-slate-400">{itemIndex + 1}</span>
                        <div className="min-w-0 flex-1"><p className="font-medium text-slate-700">{postById.get(item.postId)?.title ?? `#${item.postId}`}</p><p className="mt-0.5 text-slate-400">{item.reason}</p></div>
                        <button type="button" disabled={itemIndex === 0} onClick={() => { const items = [...group.items]; [items[itemIndex - 1], items[itemIndex]] = [items[itemIndex]!, items[itemIndex - 1]!]; updateProposalGroup(groupIndex, { ...group, items: items.map((entry, index) => ({ ...entry, order: index + 1 })) }); }}><ArrowUp className="h-3.5 w-3.5 disabled:text-slate-200" /></button>
                        <button type="button" disabled={itemIndex === group.items.length - 1} onClick={() => { const items = [...group.items]; [items[itemIndex], items[itemIndex + 1]] = [items[itemIndex + 1]!, items[itemIndex]!]; updateProposalGroup(groupIndex, { ...group, items: items.map((entry, index) => ({ ...entry, order: index + 1 })) }); }}><ArrowDown className="h-3.5 w-3.5 disabled:text-slate-200" /></button>
                        <button type="button" onClick={() => updateProposalGroup(groupIndex, { ...group, items: group.items.filter((entry) => entry.postId !== item.postId) })}><X className="h-3.5 w-3.5 text-rose-400" /></button>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
          {proposal.notes.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-500">{proposal.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setProposal(null)} className="rounded-xl px-4 py-2 text-sm text-slate-500">取消</button><button type="button" onClick={applyProposal} disabled={pending || !proposal.groups.some((group) => group.items.length)} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} 确认应用</button></div>
        </section>
      )}
    </div>
  );
}
