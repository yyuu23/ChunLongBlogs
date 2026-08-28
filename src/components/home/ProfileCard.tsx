"use client";

import { motion } from "framer-motion";
import { Mail, Link2, Rss } from "lucide-react";
import { GithubIcon, BilibiliIcon, GiteeIcon } from "@/components/ui/BrandIcons";
import type { SocialLink } from "@/lib/site";
import { useEffect, useRef, useState } from "react";

function SocialIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "github":
      return <GithubIcon className="h-4 w-4" />;
    case "bilibili":
      return <BilibiliIcon className="h-4 w-4" />;
    case "gitee":
      return <GiteeIcon className="h-4 w-4" />;
    case "email":
      return <Mail className="h-4 w-4" />;
    case "rss":
      return <Rss className="h-4 w-4" />;
    default:
      return <Link2 className="h-4 w-4" />;
  }
}

/** 个人资料卡：渐变头像环 + 简介 + 社交图标 */
export function ProfileCard({
  avatar,
  authorName,
  bio,
  socials,
}: {
  avatar: string;
  authorName: string;
  bio: string;
  socials: SocialLink[];
}) {
  return (
    <div className="glass-card glass-hover flex items-center gap-5 p-6">
      <div className="relative shrink-0">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-400 to-pink-400 opacity-80 blur-[6px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt={authorName}
          className="relative h-20 w-20 rounded-full ring-4 ring-white/70 dark:ring-slate-900/70"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-serif text-xl font-bold">{authorName}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{bio}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {socials.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target={s.url.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              title={s.label ?? s.platform}
              className="glass-button !p-2.5"
            >
              <SocialIcon platform={s.platform} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 数字滚动计数 */
function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const dur = 1200;
          const step = (t: number) => {
            const p = Math.min((t - start) / dur, 1);
            setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

export function StatsRow({
  stats,
}: {
  stats: { label: string; value: number; suffix?: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ y: 18, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08, duration: 0.45 }}
          className="glass-card glass-hover flex flex-col items-center gap-1 px-2 py-4"
        >
          <span className="text-indigo-500 dark:text-indigo-300">{s.icon}</span>
          <span className="text-xl font-bold md:text-2xl">
            <CountUp value={s.value} suffix={s.suffix} />
          </span>
          <span className="text-xs text-muted">{s.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
