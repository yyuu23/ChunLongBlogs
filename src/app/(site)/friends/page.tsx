import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { Link2, Mail } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/effects/PageTransition";
import { GithubIcon, BilibiliIcon, GiteeIcon } from "@/components/ui/BrandIcons";
import { db } from "@/lib/db";
import { friendLinks } from "@/lib/db/schema";
import { getSiteConfig } from "@/lib/site";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("friends.title") };
}

export default async function FriendsPage() {
  const [friends, config, { t }] = await Promise.all([
    db.select().from(friendLinks).orderBy(asc(friendLinks.sort), asc(friendLinks.id)),
    getSiteConfig(),
    getT(),
  ]);

  const social =
    config.socials.find((s) => s.platform === "email")?.url ??
    (config.socials[0]?.url ?? "");

  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,60rem)] pb-8">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-black">{t("friends.title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("friends.subtitle")} ·{" "}
            <a
              href={social}
              className="inline-flex items-center gap-1 text-indigo-500 hover:underline dark:text-indigo-300"
            >
              <Mail className="h-3.5 w-3.5" />
              {t("friends.apply")}
            </a>
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {friends.map((f, i) => (
            <FadeIn key={f.id} delay={Math.min(i * 0.06, 0.4)}>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="glass-card glass-hover group flex h-full items-center gap-4 p-5"
              >
                <div className="relative shrink-0">
                  <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-400 to-pink-400 opacity-0 blur-[5px] transition-opacity duration-500 group-hover:opacity-70" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.avatar}
                    alt={f.name}
                    className="relative h-14 w-14 rounded-full ring-2 ring-white/60 transition-transform duration-500 group-hover:scale-105 dark:ring-slate-800"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-serif font-bold transition-colors group-hover-text-accent dark:group-hover:text-indigo-300">
                    {f.name}
                    <Link2 className="h-3.5 w-3.5 text-muted transition-transform group-hover:rotate-12" />
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {f.description}
                  </p>
                </div>
              </a>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.2}>
          <div className="glass-card mt-8 flex flex-col items-center gap-2 p-6 text-center text-sm text-muted">
            <div className="flex items-center gap-4">
              <GithubIcon className="h-5 w-5" />
              <BilibiliIcon className="h-5 w-5" />
              <GiteeIcon className="h-5 w-5" />
            </div>
            <p>{t("friends.applyHint")}</p>
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
