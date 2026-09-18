import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Blocks, UserRound } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { renderMarkdown, markdownCacheKey } from "@/lib/content/markdown";
import { getSiteConfig } from "@/lib/site/repository";
import { getT } from "@/lib/i18n/server";
import { getPublishedProjects } from "@/lib/content/projects";
import { ProjectCard } from "@/components/projects/ProjectCard";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("nav.about") };
}

export default async function AboutPage() {
  const [config, projects, { t }] = await Promise.all([getSiteConfig(), getPublishedProjects(), getT()]);
  const html = await renderMarkdown(
    config.aboutMarkdown,
    markdownCacheKey("about", config.aboutMarkdown),
  );

  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,48rem)] pb-8">
        <header className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="relative">
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-400 to-pink-400 opacity-80 blur-md" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.avatar}
              alt={config.authorName}
              className="relative h-24 w-24 rounded-full ring-4 ring-white/70 dark:ring-slate-900/70"
            />
          </div>
          <h1 className="flex items-center gap-2 font-serif text-3xl font-black">
            <UserRound className="h-6 w-6 text-indigo-500" />
            {config.authorName}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">{config.bio}</p>
        </header>

        <FadeIn>
          <div className="glass-card px-6 py-6 md:px-9 md:py-8">
            <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </FadeIn>

        <FadeIn delay={0.08}>
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-serif text-xl font-bold">
                <Blocks className="h-5 w-5 text-accent" /> {t("projects.title")}
              </h2>
              <Link href="/projects" className="flex items-center gap-1 text-sm text-muted hover-text-accent">
                {t("projects.viewAll")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {projects.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {projects.slice(0, 4).map((project) => <ProjectCard key={project.id} project={project} />)}
              </div>
            ) : (
              <div className="glass-card p-6 text-center text-sm text-muted">{t("projects.empty")}</div>
            )}
          </section>
        </FadeIn>

        {projects.some((project) => project.startedAt) && (
          <FadeIn delay={0.12}>
            <section className="mt-8 glass-card p-6">
              <h2 className="font-serif text-lg font-bold">{t("projects.timeline")}</h2>
              <ol className="mt-4 space-y-4 border-l border-[var(--glass-border)] pl-5">
                {projects
                  .filter((project) => project.startedAt)
                  .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))
                  .map((project) => (
                    <li key={project.id} className="relative">
                      <span className="absolute -left-[1.58rem] top-1.5 h-2 w-2 rounded-full bg-accent-solid" />
                      <p className="text-xs text-muted">{project.startedAt!.toISOString().slice(0, 7)}</p>
                      <Link href={`/projects/${project.slug}`} className="font-medium hover-text-accent">{project.title}</Link>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{project.summary}</p>
                    </li>
                  ))}
              </ol>
            </section>
          </FadeIn>
        )}
      </div>
    </PageTransition>
  );
}
