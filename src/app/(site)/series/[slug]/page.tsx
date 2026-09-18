import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpenText, Clock3, ChevronRight } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { AutoCover } from "@/components/posts/AutoCover";
import { getSeriesBySlug } from "@/lib/content/series";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getSeriesBySlug(slug);
  return item ? { title: item.title, description: item.description } : { title: "Series" };
}

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, { t }] = await Promise.all([getSeriesBySlug(slug), getT()]);
  if (!item) notFound();
  const difficulty = (value: "beginner" | "intermediate" | "advanced" | null) =>
    value ? t(`series.difficulty${value[0]!.toUpperCase()}${value.slice(1)}`) : null;

  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,58rem)] pb-8">
        <header className="glass-card relative mb-7 overflow-hidden px-6 py-8 md:px-9">
          <div className="absolute inset-0 opacity-15"><AutoCover title={item.title} seed={item.slug} variant="wide" /></div>
          <div className="relative">
            <p className="flex items-center gap-1.5 text-sm font-medium text-accent"><BookOpenText className="h-4 w-4" />{t("series.label")}</p>
            <h1 className="mt-2 font-serif text-3xl font-black">{item.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{item.description}</p>
            <div className="mt-4 flex gap-3 text-xs text-muted"><span>{t("series.posts", { n: item.postCount })}</span><span>·</span><span>{t("series.minutes", { n: item.totalMinutes })}</span></div>
          </div>
        </header>
        <div className="space-y-3">
          {item.posts.map((post, index) => (
            <FadeIn key={post.id} delay={Math.min(index * 0.04, 0.2)}>
              <Link href={`/posts/${post.slug}`} className="glass-card glass-hover group flex items-center gap-4 p-4 sm:p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-sm font-bold text-accent">{index + 1}</span>
                <div className="min-w-0 flex-1"><h2 className="truncate font-serif font-bold group-hover:text-accent">{post.title}</h2><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{post.description}</p><div className="mt-2 flex gap-3 text-[0.6875rem] text-muted"><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{post.readingTime} min</span>{difficulty(post.difficulty) && <span>{difficulty(post.difficulty)}</span>}</div></div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
