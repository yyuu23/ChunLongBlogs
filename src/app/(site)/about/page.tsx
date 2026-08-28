import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { renderMarkdown } from "@/lib/markdown";
import { getSiteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "关于" };

export default async function AboutPage() {
  const config = await getSiteConfig();
  const html = await renderMarkdown(config.aboutMarkdown);

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
      </div>
    </PageTransition>
  );
}
