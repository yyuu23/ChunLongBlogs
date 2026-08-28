import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { MapPin } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { LazyImage } from "@/components/effects/Typewriter";
import { db } from "@/lib/db";
import { moments as momentsTable } from "@/lib/db/schema";
import { relativeTime, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "说说" };

export default async function MomentsPage() {
  const items = await db
    .select()
    .from(momentsTable)
    .orderBy(desc(momentsTable.createdAt));

  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,42rem)] pb-8">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-black">说说</h1>
          <p className="mt-1 text-sm text-muted">碎片的想法，不值得成文，但值得记录</p>
        </header>

        <div className="relative flex flex-col gap-5 pl-5 before:absolute before:bottom-2 before:left-[6px] before:top-2 before:w-px before:bg-gradient-to-b before:from-pink-400/60 before:via-indigo-400/40 before:to-transparent">
          {items.map((m, i) => {
            const images: string[] = JSON.parse(m.images || "[]");
            return (
              <FadeIn key={m.id} delay={Math.min(i * 0.05, 0.3)}>
                <article className="relative">
                  <span className="absolute -left-5 top-5 h-3 w-3 rounded-full bg-gradient-to-r from-pink-400 to-indigo-400 ring-4 ring-white/50 dark:ring-slate-900/50" />
                  <div className="glass-card p-5">
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="font-medium text-indigo-500 dark:text-indigo-300">
                        {m.mood || "💭"}
                      </span>
                      <time dateTime={new Date(m.createdAt).toISOString()} title={formatDateTime(m.createdAt)}>
                        {relativeTime(m.createdAt)}
                      </time>
                      {m.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {m.location}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                    {images.length > 0 && (
                      <div
                        className={`mt-3 grid gap-2 ${
                          images.length === 1
                            ? "grid-cols-1"
                            : images.length <= 4
                              ? "grid-cols-2"
                              : "grid-cols-3"
                        }`}
                      >
                        {images.map((src) => (
                          <div key={src} className="relative aspect-square overflow-hidden rounded-xl">
                            <LazyImage src={src} alt="配图" fill sizes="200px" className="object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}
