"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, BookOpen, MessageCircleHeart, Info, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useT } from "@/components/providers/LocaleProvider";

const TABS = [
  { href: "/", key: "nav.home", icon: Home },
  { href: "/posts", key: "nav.posts", icon: BookOpen },
  { href: "/moments", key: "nav.moments", icon: MessageCircleHeart },
  { href: "/about", key: "nav.about", icon: Info },
];

/** 移动端底部 Tab 栏（md 以上隐藏），中间为主题切换 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const t = useT();

  return (
    <nav className="glass-card fixed inset-x-4 bottom-4 z-50 flex items-center justify-around !rounded-3xl py-1.5 md:hidden">
      {TABS.slice(0, 2).map((tab) => (
        <TabItem key={tab.href} tab={tab} pathname={pathname} label={t(tab.key)} />
      ))}
      <button
        onClick={toggle}
        aria-label={t("nav.toggleTheme")}
        className="relative -mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent-br-gradient text-white accent-glow transition-transform active:scale-90"
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      {TABS.slice(2).map((tab) => (
        <TabItem key={tab.href} tab={tab} pathname={pathname} label={t(tab.key)} />
      ))}
    </nav>
  );
}

function TabItem({
  tab,
  pathname,
  label,
}: {
  tab: (typeof TABS)[number];
  pathname: string;
  label: string;
}) {
  const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
  const Icon = tab.icon;
  return (
    <Link href={tab.href} className="relative flex flex-col items-center gap-0.5 px-4 py-2">
      {active && (
        <motion.span
          layoutId="tab-indicator"
          className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent-gradient"
        />
      )}
      <Icon className={`h-5 w-5 ${active ? "text-accent" : "text-muted"}`} />
      <span className={`text-[10px] ${active ? "text-accent" : "text-muted"}`}>
        {label}
      </span>
    </Link>
  );
}
