import { Blocks } from "lucide-react";
import type { PublicProject } from "@/lib/content-hub";
import { ProjectCard } from "@/components/projects/ProjectCard";

export function RelatedProjects({ items, heading }: { items: PublicProject[]; heading: string }) {
  if (!items.length) return null;
  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold"><Blocks className="h-4 w-4 text-accent" />{heading}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{items.map((item) => <ProjectCard key={item.id} project={item} />)}</div>
    </section>
  );
}
