import Link from "next/link";
import { BookOpenText, FileText, Eye, PenLine } from "lucide-react";
import { HeroBanner } from "@/components/home/HeroBanner";
import { ProfileCard, StatsRow } from "@/components/home/ProfileCard";
import { AnnouncementBar } from "@/components/home/AnnouncementBar";
import { PostCard } from "@/components/posts/PostCard";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { getSiteConfig } from "@/lib/site";
import { getPublishedPosts, getSiteStats } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [config, { items: latest }, stats] = await Promise.all([
    getSiteConfig(),
    getPublishedPosts({ perPage: 6 }),
    getSiteStats(),
  ]);

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
            <StatsRow
              stats={[
                { label: "文章", value: stats.posts, icon: <FileText className="h-5 w-5" /> },
                { label: "总字数", value: stats.words, icon: <PenLine className="h-5 w-5" /> },
                { label: "总阅读", value: stats.views, icon: <Eye className="h-5 w-5" /> },
              ]}
            />
          </FadeIn>
        </div>

        <FadeIn delay={0.05}>
          <div className="mt-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-xl font-bold">
              <BookOpenText className="h-5 w-5 text-indigo-500" />
              最新文章
            </h2>
            <Link
              href="/posts"
              className="text-sm text-muted transition-colors hover:text-indigo-500"
            >
              查看全部 →
            </Link>
          </div>
        </FadeIn>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
