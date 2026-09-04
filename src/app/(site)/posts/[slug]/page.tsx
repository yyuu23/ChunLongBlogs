import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Clock3, Home, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { LazyImage } from "@/components/effects/Typewriter";
import { AutoCover } from "@/components/posts/AutoCover";
import { Toc } from "@/components/posts/Toc";
import { ViewCounter, GiscusComments } from "@/components/posts/PostExtras";
import { CodeBlockTools } from "@/components/posts/CodeBlockTools";
import { ImmersiveToggle } from "@/components/posts/ImmersiveToggle";
import { getPostBySlug, getNeighborPosts } from "@/lib/posts";
import { renderMarkdown, extractToc, markdownCacheKey } from "@/lib/markdown";
import { getSiteConfig } from "@/lib/site";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, { t }] = await Promise.all([params, getT()]);
  const post = await getPostBySlug(slug);
  if (!post) return { title: t("posts.notFound") };
  // 分享卡图：有封面用封面；无封面走 /api/og 动态渲染的渐变图（与 AutoCover 同视觉）
  const image = post.cover || `/api/og/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [image],
    },
  };
}

export default async function PostDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [post, config, { t }] = await Promise.all([getPostBySlug(slug), getSiteConfig(), getT()]);
  if (!post || post.status !== "published") notFound();

  const [html, neighbors] = await Promise.all([
    // 以内容派生 key 缓存渲染结果：shiki 十主题管线是 SSR 的 CPU 大头，
    // 热门文章重复访问不再重渲染；内容变更 key 自然改变
    renderMarkdown(post.content, markdownCacheKey("post", post.content)),
    getNeighborPosts(post.publishedAt, post.id),
  ]);
  const toc = extractToc(post.content);

  return (
    <PageTransition>
      <article data-cl-article className="mx-auto w-[min(96%,72rem)] pb-8">
        {/* 面包屑 */}
        <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted">
          <Link href="/" className="inline-flex items-center gap-1 hover-text-accent">
            <Home className="h-3.5 w-3.5" /> {t("nav.home")}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/posts" className="hover-text-accent">{t("nav.posts")}</Link>
          {post.category && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link
                href={`/posts?category=${post.category.slug}`}
                className="hover-text-accent"
              >
                {post.category.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="max-w-[16rem] truncate">{post.title}</span>
        </nav>

        <div data-cl-article-grid className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            <FadeIn>
              <div className="glass-card overflow-hidden">
                {/* 头部 */}
                <header className="flex flex-col gap-4 p-6 md:p-8">
                  <h1 className="font-serif text-2xl font-black leading-snug md:text-3xl">
                    {post.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(post.publishedAt ?? post.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {t("posts.wordMinute", { w: post.wordCount, m: post.readingTime })}
                    </span>
                    <ViewCounter slug={post.slug} initial={post.views} postId={post.id} />
                    <ImmersiveToggle />
                  </div>
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((t) => (
                        <Link
                          key={t.id}
                          href={`/posts?tag=${t.slug}`}
                          className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent transition-opacity hover:opacity-80"
                        >
                          # {t.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </header>

                <div className="relative aspect-[21/9]">
                  {post.cover ? (
                    <LazyImage
                      src={post.cover}
                      alt={post.title}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      className="object-cover"
                      fallback={<AutoCover title={post.title} seed={post.slug} variant="wide" />}
                    />
                  ) : (
                    <AutoCover title={post.title} seed={post.slug} variant="wide" />
                  )}
                </div>

                {/* 正文 */}
                <div
                  className="md px-6 py-6 md:px-8 md:py-8"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                {/* 给上面注入的代码块补语言标签 + 复制按钮（slug 变则重新注入） */}
                <CodeBlockTools slug={post.slug} />
              </div>
            </FadeIn>

            {/* 上一篇 / 下一篇 */}
            {(neighbors.prev || neighbors.next) && (
              <FadeIn delay={0.1}>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {neighbors.prev ? (
                    <Link href={`/posts/${neighbors.prev.slug}`} className="glass-card glass-hover group flex items-center gap-3 p-4 text-sm">
                      <ArrowLeft className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-x-1" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted">{t("posts.prevPost")}</p>
                        <p className="truncate font-medium">{neighbors.prev.title}</p>
                      </div>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {neighbors.next && (
                    <Link href={`/posts/${neighbors.next.slug}`} className="glass-card glass-hover group flex items-center justify-end gap-3 p-4 text-right text-sm">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">{t("posts.nextPost")}</p>
                        <p className="truncate font-medium">{neighbors.next.title}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
                    </Link>
                  )}
                </div>
              </FadeIn>
            )}

            {/* 评论 */}
            <FadeIn delay={0.15}>
              <section className="mt-8">
                <h2 className="mb-4 font-serif text-lg font-bold">{t("posts.comments")}</h2>
                <GiscusComments config={config.giscus} />
              </section>
            </FadeIn>
          </div>

          {/* 目录侧栏 */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <Toc items={toc} />
            </div>
          </aside>
        </div>
      </article>
    </PageTransition>
  );
}
