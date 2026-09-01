import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { BookOpenText, FileText, Eye, PenLine, Images } from "lucide-react";
import { HeroBanner } from "@/components/home/HeroBanner";
import { ProfileCard, StatsRow } from "@/components/home/ProfileCard";
import { AnnouncementBar } from "@/components/home/AnnouncementBar";
import { WeatherCard } from "@/components/home/WeatherCard";
import { PostCard } from "@/components/posts/PostCard";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { LazyImage } from "@/components/effects/Typewriter";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { getSiteConfig } from "@/lib/site";
import { getPublishedPosts, getSiteStats } from "@/lib/posts";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [config, { items: latest }, stats, albumRows, { t }] = await Promise.all([
    getSiteConfig(),
    getPublishedPosts({ perPage: 6 }),
    getSiteStats(),
    db.select().from(albums).orderBy(desc(albums.createdAt)).limit(1),
    getT(),
  ]);
  const latestAlbum = albumRows[0] ?? null;
  const photoCount = latestAlbum
    ? (
        await db
          .select({ n: sql<number>`count(*)` })
          .from(photos)
          .where(eq(photos.albumId, latestAlbum.id))
      )[0]?.n ?? 0
    : 0;

  return (
    <PageTransition>
      <div className="mx-auto flex w-[min(96%,72rem)] flex-col gap-6">
        <FadeIn>
          <HeroBanner banners={config.banners} />
        </FadeIn>

        <FadeIn delay={0.1}>
          <AnnouncementBar customText={config.announcement.customText} />
        </FadeIn>

        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <FadeIn delay={0.15}>
            <ProfileCard
              avatar={config.avatar}
              authorName={config.authorName}
              bio={config.bio}
              socials={config.socials}
            />
          </FadeIn>
          <FadeIn delay={0.22}>
            <div className="flex flex-col gap-6">
              <StatsRow
                stats={[
                  { label: t("home.statsPosts"), value: stats.posts, icon: <FileText className="h-5 w-5" /> },
                  { label: t("home.statsWords"), value: stats.words, icon: <PenLine className="h-5 w-5" /> },
                  { label: t("home.statsViews"), value: stats.views, icon: <Eye className="h-5 w-5" /> },
                ]}
              />
              <WeatherCard />
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.05}>
          <div className="mt-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-xl font-bold">
              <BookOpenText className="h-5 w-5 text-indigo-500" />
              {t("home.latestPosts")}
            </h2>
            <Link
              href="/posts"
              className="text-sm text-muted transition-colors hover:text-indigo-500"
            >
              {t("common.viewAll")} →
            </Link>
          </div>
        </FadeIn>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} />
          ))}
        </div>

        {/* 最新相册海报卡 */}
        {latestAlbum && (
          <FadeIn delay={0.1}>
            <Link href="/albums" className="group mt-6 block">
              <div className="glass-card glass-hover relative h-44 overflow-hidden md:h-56">
                <LazyImage
                  src={latestAlbum.cover || "/assets/photos/p1.svg"}
                  alt={latestAlbum.title}
                  fill
                  sizes="100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 md:p-6">
                  <div className="min-w-0">
                    <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-medium tracking-widest text-white/80">
                      <Images className="h-3.5 w-3.5" />
                      {t("home.latestAlbums")}
                    </p>
                    <h2 className="font-serif text-xl font-bold text-white drop-shadow md:text-2xl">
                      {latestAlbum.title}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-white/75 md:text-sm">
                      {latestAlbum.description} · {t("home.albumPhotosCount", { n: Number(photoCount) })}
                    </p>
                  </div>
                  <span className="glass-button shrink-0 border-white/30 bg-white/15 !text-white hover:!bg-white/30">
                    {t("home.viewAlbums")}
                  </span>
                </div>
              </div>
            </Link>
          </FadeIn>
        )}
      </div>
    </PageTransition>
  );
}
