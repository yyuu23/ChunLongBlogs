import Link from "next/link";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import type { PublicProject } from "@/lib/content-hub";
import { getT } from "@/lib/i18n/server";

export async function ProjectCard({ project }: { project: PublicProject }) {
  const { t } = await getT();
  return (
    <Link href={`/projects/${project.slug}`} className="glass-card glass-hover group block overflow-hidden">
      {project.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={project.cover} alt={project.title} className="aspect-[16/8] w-full object-cover" loading="lazy" />
      ) : (
        <div className="aspect-[16/8] bg-accent-gradient opacity-70" />
      )}
      <div className="p-5">
        <span className="mb-2 inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] text-accent">{t(`projects.stage.${project.stage}`)}</span>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-lg font-bold transition-colors group-hover:text-accent">{project.title}</h2>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{project.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {project.techStack.slice(0, 6).map((tech) => (
            <span key={tech} className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] text-accent">{tech}</span>
          ))}
          {project.labSlug && <FlaskConical className="ml-auto h-3.5 w-3.5 text-muted" />}
        </div>
      </div>
    </Link>
  );
}
