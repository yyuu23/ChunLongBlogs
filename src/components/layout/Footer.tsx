import Link from "next/link";
import { Rss, Lock, Heart } from "lucide-react";
import type { SiteConfig } from "@/lib/site";
import { getT } from "@/lib/i18n/server";

export async function Footer({ config }: { config: SiteConfig }) {
  const { t } = await getT();
  return (
    <footer className="relative z-10 mt-16 pb-24 md:pb-8">
      <div className="mx-auto w-[min(96%,72rem)] px-2 text-center text-sm text-muted">
        <div className="mb-3 flex items-center justify-center gap-4">
          <Link href="/feed" aria-label="RSS" className="transition-colors hover-text-accent">
            <Rss className="h-4 w-4" />
          </Link>
          <Link href="/admin" aria-label={t("footer.admin")} className="transition-colors hover-text-accent">
            <Lock className="h-4 w-4" />
          </Link>
        </div>
        <p>
          © {new Date().getFullYear()} {config.siteName} · Powered by Next.js
        </p>
        {config.ccLicense && (
          <a
            href={`https://creativecommons.org/licenses/${config.ccLicense
              .toLowerCase()
              .split(/\s+/)
              .join("/")}/`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block transition-colors hover-text-accent"
          >
            CC {config.ccLicense}
          </a>
        )}
        <p className="mt-1 flex items-center justify-center gap-1">
          Made with <Heart className="h-3 w-3 text-pink-400" /> and React
        </p>
        {config.icp && (
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block"
          >
            {config.icp}
          </a>
        )}
        {config.footerText && <p className="mt-1">{config.footerText}</p>}
      </div>
    </footer>
  );
}
