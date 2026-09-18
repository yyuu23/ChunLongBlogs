import Link from "next/link";
import { LazyImage } from "@/components/effects/Typewriter";
import { AutoCover } from "@/components/posts/AutoCover";
import type { RelatedPostItem } from "@/lib/content/rag/related";
import { DATE_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * 相关阅读（文章正文后）：embedding 相似度推荐（lib/rag relatedPosts），
 * 简化版卡片（无 3D 倾斜），空数组时整块不渲染。
 * 文案由页面的服务端翻译函数传入，避免为了一个标题把整块变成客户端组件。
 */
export function RelatedPosts({
  items,
  locale,
  heading,
}: {
  items: RelatedPostItem[];
  locale: Locale;
  heading: string;
}) {
  if (!items.length) return null;
  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString(DATE_LOCALE[locale]) : "";

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted">{heading}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((p) => (
          <Link key={p.id} href={`/posts/${p.slug}`} className="glass-card glass-hover group block overflow-hidden !p-0">
            <div className="relative aspect-[16/9] overflow-hidden">
              {p.cover ? (
                <LazyImage
                  src={p.cover.replace(/^http:\/\//, "https://")}
                  alt={p.title}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <AutoCover title={p.title} seed={p.slug} variant="wide" />
              )}
            </div>
            <div className="p-3.5">
              {p.category && (
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.category.color }} />
                  {p.category.name}
                  {p.publishedAt ? <span className="opacity-60">· {fmtDate(p.publishedAt)}</span> : null}
                </p>
              )}
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-accent">
                {p.title}
              </h3>
              {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.description}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
