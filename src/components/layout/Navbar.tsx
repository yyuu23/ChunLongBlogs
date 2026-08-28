"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sun, Moon, Menu, X, Sparkles } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { LogoEgg } from "@/components/effects/LogoEgg";
import { CalendarPopover } from "@/components/layout/CalendarPopover";

const LINKS = [
  { href: "/", label: "首页" },
  { href: "/posts", label: "文章" },
  { href: "/archive", label: "归档" },
  { href: "/moments", label: "说说" },
  { href: "/albums", label: "相册" },
  { href: "/lab", label: "实验室" },
  { href: "/music", label: "音乐" },
  { href: "/friends", label: "友链" },
  { href: "/about", label: "关于" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar({ siteName, avatar }: { siteName: string; avatar: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState("");
  const lastY = useRef(0);
  // Logo 彩蛋：3 秒窗口内连击 7 次
  const [eggTrigger, setEggTrigger] = useState(0);
  const logoClicks = useRef<number[]>([]);
  const onLogoClick = () => {
    const now = Date.now();
    logoClicks.current = [...logoClicks.current.filter((t) => now - t < 3000), now];
    if (logoClicks.current.length >= 7) {
      logoClicks.current = [];
      setEggTrigger((n) => n + 1);
    }
  };

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      // 下滑隐藏、上滑显示（顶部附近不隐藏）
      setHidden(y > 120 && y > lastY.current);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  const goSearch = () => {
    const kw = q.trim();
    if (kw) router.push(`/posts?q=${encodeURIComponent(kw)}`);
  };

  return (
    <>
      <LogoEgg trigger={eggTrigger} />
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <nav
          className={`mx-auto mt-3 flex h-14 w-[min(96%,72rem)] items-center gap-2 rounded-full px-4 transition-all duration-500 ${
            scrolled
              ? "glass-card !rounded-full"
              : "bg-transparent border border-transparent"
          }`}
        >
          {/* Logo（七连击有彩蛋） */}
          <Link href="/" onClick={onLogoClick} className="flex shrink-0 items-center gap-2.5 pl-1 pr-2">
            <span className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-indigo-400/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar} alt={siteName} className="h-full w-full object-cover" />
            </span>
            <span className="font-serif text-lg font-bold tracking-wide">
              {siteName}
            </span>
          </Link>

          {/* 桌面导航 */}
          <div className="ml-2 hidden flex-1 items-center gap-1 md:flex">
            {LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    active ? "text-white" : "text-muted hover-text-accent"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="navbar-indicator"
                      className="absolute inset-0 rounded-full accent-glow bg-accent-gradient"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* 搜索 + 主题 + 移动端菜单 */}
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <div className="hidden items-center lg:flex">
              <Search className="pointer-events-none h-4 w-4 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goSearch()}
                placeholder="搜索文章…"
                className="glass-input w-40 border-0 bg-transparent py-1 pl-6 focus:!shadow-none"
              />
            </div>
            <div className="hidden md:block"><CalendarPopover /></div>
            <button
              onClick={toggle}
              aria-label="切换主题"
              className="glass-button !rounded-full !p-2.5"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </motion.span>
              </AnimatePresence>
            </button>
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="菜单"
              className="glass-button !rounded-full !p-2.5 md:hidden"
            >
              {drawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>
      </header>

      {/* 移动端抽屉 */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              className="glass-card fixed inset-x-4 top-20 z-40 origin-top p-4 md:hidden"
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="mb-3 flex items-center gap-2 lg:hidden">
                <Search className="h-4 w-4 shrink-0 text-muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      goSearch();
                      setDrawerOpen(false);
                    }
                  }}
                  placeholder="搜索文章…"
                  className="glass-input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LINKS.map((link, i) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      href={link.href}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
                        isActive(pathname, link.href)
                          ? "bg-accent-gradient text-white"
                          : "text-muted hover:bg-white/30 dark:hover:bg-white/5"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
