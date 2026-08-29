import Link from "next/link";
import type { Metadata } from "next";
import { Archive as ArchiveIcon } from "lucide-react";
import { PageTransition } from "@/components/effects/PageTransition";
import { FadeIn } from "@/components/effects/PageTransition";
import { getArchive } from "@/lib/posts";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "归档" };

export default async function ArchivePage() {
  const posts = await getArchive();

  // 年 → 月 两级分组（均倒序）
  const byYear = new Map<number, Map<number, typeof posts>>();
  for (const p of posts) {
    const d = new Date(p.publishedAt ?? p.createdAt);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    if (!byYear.has(year)) byYear.set(year, new Map());
    const months = byYear.get(year)!;
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(p);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,48rem)] pb-8">
        <header className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-gradient text-white">
            <ArchiveIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-3xl font-black">归档</h1>
            <p className="text-sm text-muted">共 {posts.length} 篇 · 时间是最好的索引</p>
          </div>
        </header>

        <div className="relative flex flex-col gap-10 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-gradient-to-b before:from-indigo-400/60 before:via-purple-400/40 before:to-transparent">
          {years.map((year) => {
            const months = byYear.get(year)!;
            const monthKeys = [...months.keys()].sort((a, b) => b - a);
            const yearTotal = [...months.values()].reduce((n, list) => n + list.length, 0);
            return (
              <section key={year}>
                <FadeIn>
                  <h2 className="relative mb-4 flex items-baseline gap-3 font-serif text-2xl font-bold">
                    <span className="absolute -left-6 h-3.5 w-3.5 rounded-full bg-accent-gradient ring-4 ring-white/50 dark:ring-slate-900/50" />
                    {year}
                    <span className="text-sm font-normal text-muted">{yearTotal} 篇</span>
                  </h2>
                </FadeIn>

                {monthKeys.map((month) => (
                  <div key={month} className="mb-5 last:mb-0">
                    <FadeIn>
                      <h3 className="relative mb-2 flex items-center gap-2 pl-1 text-sm font-bold tracking-widest text-muted">
                        {/* 时间轴上的月份短刻度 */}
                        <span className="absolute -left-6 top-1/2 h-px w-2.5 -translate-y-1/2 bg-accent-solid" />
                        {month} 月
                        <span className="text-[11px] font-normal opacity-70">
                          {months.get(month)!.length} 篇
                        </span>
                        <span className="h-px flex-1 bg-[var(--glass-border)]" />
                      </h3>
                    </FadeIn>
                    <div className="flex flex-col gap-2">
                      {months.get(month)!.map((p, i) => (
                        <FadeIn key={p.id} delay={Math.min(i * 0.04, 0.3)}>
                          <Link
                            href={`/posts/${p.slug}`}
                            className="glass-card glass-hover group flex items-baseline gap-4 px-5 py-3.5 text-sm"
                          >
                            <span className="shrink-0 font-mono text-xs text-muted">
                              {formatDate(p.publishedAt ?? p.createdAt)}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium transition-colors group-hover:text-[var(--accent-text)]">
                              {p.title}
                            </span>
                            {p.category && (
                              <span
                                className="hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] text-white sm:inline-block"
                                style={{ backgroundColor: `${p.category.color}cc` }}
                              >
                                {p.category.name}
                              </span>
                            )}
                          </Link>
                        </FadeIn>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}
