"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sun, Moon, Menu, X, Sparkles } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { usePlayer } from "@/components/music/PlayerProvider";
import { useT } from "@/components/providers/LocaleProvider";
import { LogoEgg } from "@/components/effects/LogoEgg";
import { CalendarPopover } from "@/components/layout/CalendarPopover";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { trackEvent } from "@/lib/track";

/** 路由 → 词典 key（label 经 t() 现场翻译） */
const LINKS = [
  { href: "/", key: "nav.home" },
  { href: "/posts", key: "nav.posts" },
  { href: "/archive", key: "nav.archive" },
  { href: "/moments", key: "nav.moments" },
  { href: "/albums", key: "nav.albums" },
  { href: "/lab", key: "nav.lab" },
  { href: "/music", key: "nav.music" },
  { href: "/chat", key: "nav.aiChat" },
  { href: "/friends", key: "nav.friends" },
  { href: "/about", key: "nav.about" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar({ siteName, avatar }: { siteName: string; avatar: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { playing } = usePlayer() ?? {};
  const t = useT();
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
      trackEvent("find_egg");
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
    if (!kw) return;
    trackEvent("use_search"); // 不带关键词，隐私优先
    router.push(`/posts?q=${encodeURIComponent(kw)}`);
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
          className={`mx-auto mt-3 flex h-14 w-[min(96%,80rem)] items-center gap-2 rounded-full px-4 transition-all duration-500 ${
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

          {/* 桌面导航
              justify-evenly + gap-1 就是 Word 里「分散对齐」的 CSS 等价物：
              多余空间平均分配到每个间隔（含首尾两端），标签短（中韩 2 字）间距自动变宽，
              标签长（英文/日文）自动收缩；gap-1 是下限兜底，再挤也不会贴死。
              lg 才显示：9 个链接在 768–1024px 放不下，交给汉堡菜单。 */}
          <div className="ml-2 hidden min-w-0 flex-1 items-center justify-evenly gap-1 lg:flex">
            {LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  /* shrink-0 + whitespace-nowrap：CJK 在窄宽度下会按字换行（首/页 两行），
                     强制不换行并保持链接宽度；空间不够时由中间的搜索框先压缩。 */
                  className={`relative shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-sm transition-colors ${
                    active ? "text-white" : "text-muted hover-text-accent"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="navbar-indicator"
                      /* -inset-y/x-1.5：紫色块比文字四周各多 6px，文字不再贴边。
                         border-white/25：1px 玻璃质感亮边，让渐变有个清晰的轮廓。
                         overflow-hidden：把下面那层高光裁成同样的胶囊形。
                         用 border 而不是 ring：ring 也用 box-shadow，会把 accent-glow 盖掉。 */
                      className="absolute -inset-y-1.5 -inset-x-1.5 overflow-hidden rounded-full border border-white/25 bg-accent-gradient accent-glow"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    >
                      {/* 顶部高光：只取上半截的白色→透明渐变，模拟光从上方打过来。
                          裁在胶囊里，边缘自然跟着弧度走。 */}
                      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/35 to-transparent" />
                    </motion.span>
                  )}
                  {/* 前导小点：只在选中时出现，所以不占未选中项的宽度
                      （常驻会多出 9×8=72px，1024px 下日语会挤爆）。
                      文字随之左移约 4px，由 layoutId 的弹簧动画一起吃进去。
                      两种语义分开：
                        白点 = 「你在这里」（位置），跟随选中项
                        绿点 = 「此刻正在发生」（状态），只挂在音乐且有歌在放时
                      闪烁是强符号，不该用来标位置；表示"正在播放"才是它的本义。 */}
                  <span className="relative z-10 flex items-center justify-center gap-1 whitespace-nowrap">
                    {link.href === "/music" && playing ? (
                      <span className="relative flex h-1.5 w-1.5 shrink-0" title={t("nav.musicPlaying")}>
                        <span className="live-ring absolute inset-0 rounded-full bg-emerald-400" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                      </span>
                    ) : (
                      active && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="h-1 w-1 shrink-0 rounded-full bg-white"
                        />
                      )
                    )}
                    {t(link.key)}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* 搜索 + 主题 + 移动端菜单 */}
          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            {/* xl 才进导航：1024–1280px 放不下 9 链接 + 搜索框，那一段交给抽屉 */}
            <div className="hidden min-w-0 items-center xl:flex">
              {/* 搜索：之前 border-0 bg-transparent，只剩一个孤零零的放大镜。
                  现在做成跟整条导航一致的毛玻璃胶囊，focus 时高亮边框。 */}
              <label className="flex w-44 items-center gap-2 rounded-full border border-white/30 bg-white/35 px-3 py-1.5 backdrop-blur-md transition-colors focus-within:border-indigo-400/70 focus-within:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:focus-within:bg-white/10">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goSearch()}
                  placeholder={t("nav.searchPlaceholder")}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted/70"
                />
              </label>
            </div>
            <div className="hidden md:block"><CalendarPopover /></div>
            <LanguageSwitcher />
            <button
              onClick={toggle}
              aria-label={t("nav.toggleTheme")}
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
              aria-label={t("nav.menu")}
              className="glass-button !rounded-full !p-2.5 xl:hidden"
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
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm xl:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              className="glass-card fixed inset-x-4 top-20 z-40 origin-top p-4 xl:hidden"
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {/* 抽屉搜索：1024–1280px 是唯一的搜索入口（胶囊要 xl 才进导航）。
                  所以这里不能再加 lg:hidden —— 否则那一段宽度下彻底搜不了。 */}
              <div className="mb-3 flex items-center gap-2">
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
                  placeholder={t("nav.searchPlaceholder")}
                  className="glass-input w-full"
                />
              </div>
              {/* lg 起链接已在导航里，抽屉只留搜索，避免重复一整屏 */}
              <div className="grid grid-cols-2 gap-2 lg:hidden">
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
                      {t(link.key)}
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
