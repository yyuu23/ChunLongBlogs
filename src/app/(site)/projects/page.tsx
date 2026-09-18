import type { Metadata } from "next";
import { Blocks } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { getPublishedProjects } from "@/lib/content/projects";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("projects.title"), description: t("projects.subtitle") };
}

export default async function ProjectsPage() {
  const [items, { t }] = await Promise.all([getPublishedProjects(), getT()]);
  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,64rem)] pb-8">
        <header className="mb-8 text-center"><h1 className="flex items-center justify-center gap-2 font-serif text-3xl font-black"><Blocks className="h-7 w-7 text-accent" />{t("projects.title")}</h1><p className="mt-2 text-sm text-muted">{t("projects.subtitle")}</p></header>
        {items.length ? <div className="grid gap-5 md:grid-cols-2">{items.map((item, index) => <FadeIn key={item.id} delay={Math.min(index * 0.06, 0.24)}><ProjectCard project={item} /></FadeIn>)}</div> : <div className="glass-card p-10 text-center text-sm text-muted">{t("projects.empty")}</div>}
      </div>
    </PageTransition>
  );
}
