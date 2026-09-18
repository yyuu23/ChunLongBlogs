import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, FlaskConical, Layers3 } from "lucide-react";
import { GithubIcon } from "@/components/ui/BrandIcons";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { getProjectBySlug } from "@/lib/content/projects";
import { renderMarkdown, markdownCacheKey } from "@/lib/content/markdown";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getProjectBySlug(slug);
  return item ? { title: item.title, description: item.summary } : { title: "Project" };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, { t }] = await Promise.all([getProjectBySlug(slug), getT()]);
  if (!item) notFound();
  const html = await renderMarkdown(item.content, markdownCacheKey("project", item.content));

  return (
    <PageTransition>
      <article className="mx-auto w-[min(96%,58rem)] pb-8">
        <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover-text-accent">
          <ArrowLeft className="h-4 w-4" />
          {t("projects.title")}
        </Link>
        <FadeIn>
          <div className="glass-card overflow-hidden">
            {item.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.cover} alt={item.title} className="aspect-[21/8] w-full object-cover" />
            )}
            <header className="p-6 md:p-8">
              <span className="mb-3 inline-flex rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
                {t(`projects.stage.${item.stage}`)}
              </span>
              <h1 className="font-serif text-3xl font-black">{item.title}</h1>
              <p className="mt-3 leading-relaxed text-muted">{item.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.techStack.map((tech) => (
                  <span key={tech} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">{tech}</span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {item.repoUrl && <a href={item.repoUrl} target="_blank" rel="noreferrer" className="glass-button"><GithubIcon className="h-4 w-4" />{t("projects.repository")}</a>}
                {item.demoUrl && <a href={item.demoUrl} target="_blank" rel="noreferrer" className="glass-button"><ExternalLink className="h-4 w-4" />{t("projects.demo")}</a>}
                {item.labSlug && <Link href={`/lab/${item.labSlug}`} className="glass-button"><FlaskConical className="h-4 w-4" />{t("projects.lab")}</Link>}
              </div>
            </header>
            <div className="md border-t border-[var(--glass-border)] px-6 py-6 md:px-8" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </FadeIn>

        {item.posts.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold"><Layers3 className="h-4 w-4 text-accent" />{t("projects.relatedPosts")}</h2>
            <div className="space-y-3">
              {item.posts.map((post) => (
                <Link key={post.id} href={`/posts/${post.slug}`} className="glass-card glass-hover block p-4">
                  <h3 className="font-medium">{post.title}</h3>
                  <p className="mt-1 text-xs text-muted">{post.description} · {post.readingTime} min</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </PageTransition>
  );
}
