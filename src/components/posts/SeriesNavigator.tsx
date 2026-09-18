import Link from "next/link";
import { BookOpenText, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import type { getSeriesForPost } from "@/lib/content/series";

type SeriesNav = NonNullable<Awaited<ReturnType<typeof getSeriesForPost>>>;

export function SeriesNavigator({
  data,
  labels,
}: {
  data: SeriesNav;
  labels: { series: string; progress: string; directory: string; prev: string; next: string };
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-white/35 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <BookOpenText className="h-3.5 w-3.5" /> {labels.series}
          </p>
          <Link href={`/series/${data.slug}`} className="mt-0.5 block truncate font-serif text-lg font-bold hover-text-accent">
            {data.title}
          </Link>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">{labels.progress}</span>
      </div>
      <details>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm text-muted transition-colors hover:text-accent">
          {labels.directory} · {data.total}
        </summary>
        <ol className="border-t border-[var(--glass-border)] px-4 py-3">
          {data.entries.map((entry, index) => (
            <li key={entry.id}>
              <Link
                href={`/posts/${entry.slug}`}
                aria-current={entry.id === data.entries[data.current - 1]?.id ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${
                  entry.id === data.entries[data.current - 1]?.id
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:bg-white/30 hover:text-accent dark:hover:bg-white/5"
                }`}
              >
                <span className="w-5 text-right font-mono text-xs opacity-60">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                <span className="flex shrink-0 items-center gap-1 text-[0.6875rem] opacity-70">
                  <Clock3 className="h-3 w-3" /> {entry.readingTime}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </details>
      {(data.prev || data.next) && (
        <div className="grid border-t border-[var(--glass-border)] sm:grid-cols-2">
          {data.prev ? (
            <Link href={`/posts/${data.prev.slug}`} className="group flex min-w-0 items-center gap-2 px-4 py-3 text-sm hover:bg-white/25 dark:hover:bg-white/5">
              <ChevronLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
              <span className="min-w-0"><span className="block text-[0.6875rem] text-muted">{labels.prev}</span><span className="block truncate">{data.prev.title}</span></span>
            </Link>
          ) : <span />}
          {data.next && (
            <Link href={`/posts/${data.next.slug}`} className="group flex min-w-0 items-center justify-end gap-2 border-t border-[var(--glass-border)] px-4 py-3 text-right text-sm hover:bg-white/25 dark:hover:bg-white/5 sm:border-l sm:border-t-0">
              <span className="min-w-0"><span className="block text-[0.6875rem] text-muted">{labels.next}</span><span className="block truncate">{data.next.title}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
