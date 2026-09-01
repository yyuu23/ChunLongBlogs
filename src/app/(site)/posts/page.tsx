import Link from "next/link";
import type { Metadata } from "next";
import { FolderOpen, Tag, SearchX } from "lucide-react";
import { PageTransition } from "@/components/effects/PageTransition";
import { PostCard } from "@/components/posts/PostCard";
import { ViewSwitch } from "@/components/posts/ViewSwitch";
import { Pagination } from "@/components/posts/Pagination";
import { getCategoriesWithCount, getPublishedPosts, getTagsWithCount } from "@/lib/posts";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("nav.posts") };
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function normalize(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PostsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const category = normalize(sp.category);
  const tag = normalize(sp.tag);
  const q = normalize(sp.q);
  const page = Math.max(1, Number(normalize(sp.page) ?? 1) || 1);

  const [{ items, total, perPage }, cats, tags, { t }] = await Promise.all([
    getPublishedPosts({ category, tag, q, page, perPage: 9 }),
    getCategoriesWithCount(),
    getTagsWithCount(),
    getT(),
  ]);

  const params: Record<string, string | undefined> = { category, tag, q };
  const chipBase =
    "rounded-full border px-3 py-1 text-xs transition-all";
  const chipOff = "border-transparent bg-accent-soft text-muted hover-text-accent";
  const chipOn =
    "border-transparent bg-accent-gradient text-white shadow";

  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,72rem)] pb-8">
        <header className="mb-6">
          <h1 className="font-serif text-3xl font-black">
            {q
              ? t("posts.searchTitle", { q })
              : tag
                ? t("posts.tagTitle", { tag })
                : category
                  ? t("posts.categoryTitle", { category })
                  : t("posts.all")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("posts.count", { n: total })}</p>
        </header>

        {/* 筛选器 */}
        <div className="glass-card mb-8 flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <FolderOpen className="h-3.5 w-3.5" /> {t("posts.categories")}
            </span>
            <Link href="/posts" className={`${chipBase} ${!category && !tag ? chipOn : chipOff}`}>
              {t("posts.allCategories")}
            </Link>
            {cats
              .filter((c) => c.count > 0)
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/posts?category=${c.slug}`}
                  className={`${chipBase} ${category === c.slug ? chipOn : chipOff}`}
                >
                  {c.name}
                  <span className="ml-1 opacity-70">({c.count})</span>
                </Link>
              ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <Tag className="h-3.5 w-3.5" /> {t("posts.tags")}
            </span>
            {tags
              .filter((t) => t.count > 0)
              .map((t) => (
                <Link
                  key={t.id}
                  href={`/posts?tag=${t.slug}`}
                  className={`${chipBase} ${tag === t.slug ? chipOn : chipOff}`}
                >
                  #{t.name}
                  <span className="ml-1 opacity-70">({t.count})</span>
                </Link>
              ))}
          </div>
        </div>

        {/* 文章列表 */}
        {items.length ? (
          <ViewSwitch
            gridSlot={items.map((p, i) => (
              <PostCard key={p.id} post={p} index={i} variant="grid" />
            ))}
            listSlot={items.map((p, i) => (
              <PostCard key={p.id} post={p} index={i} variant="list" />
            ))}
          />
        ) : (
          <div className="glass-card flex flex-col items-center gap-3 p-14 text-center">
            <SearchX className="h-10 w-10 text-muted" />
            <p className="text-muted">{t("posts.noResults")}</p>
            <Link href="/posts" className="glass-button">
              {t("common.viewAll")}
            </Link>
          </div>
        )}

        <Pagination page={page} perPage={perPage} total={total} params={params} />
      </div>
    </PageTransition>
  );
}
