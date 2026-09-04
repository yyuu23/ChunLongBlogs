"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sun, Moon, Monitor, Menu, X, Sparkles } from "lucide-react";
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
  const { theme, mode, setMode } = useTheme();
  const { playing } = usePlayer() ?? {};
  const t = useT();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeWrapRef = useRef<HTMLDivElement>(null);
  // 搜索快捷键角标（Mac 显示 ⌘K，其余 Ctrl K）；挂载后判定，SSR 时不渲染
  const [shortcutKey, setShortcutKey] = useState("");
  useEffect(() => {
    setShortcutKey(
      /mac|iphone|ipad/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K",
    );
  }, []);
  const [q, setQ] = useState("");
  // 光标点当前挂在哪个链接上：hover 优先（跑过去"接你"），离开导航后弹回激活项
  const [hovered, setHovered] = useState<string | null>(null);
  const lastY = useRef(0);
  // Logo 彩蛋：3 秒窗口内连击 7 次
  const [eggTrigger, setEggTrigger] = useState(0);
  const logoClicks = useRef<number[]>([]);
  // 主题弹层：点击外部关闭（CalendarPopover 同款模式）
  useEffect(() => {
    if (!themeOpen) return;
    const onDown = (e: MouseEvent) => {
      if (themeWrapRef.current && !themeWrapRef.current.contains(e.target as Node))
        setThemeOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [themeOpen]);
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
        data-cl-chrome
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
              lg 才显示：9 个链接在 768–1024px 放不下，交给汉堡菜单。
              激活态 = 渐变文字（标"你在这里"）+ 文字下方一枚呼吸发光的光标点；
              hover 其他项时光标点先滑过去"接你"，移开导航后弹回激活项。 */}
          <div
            className="ml-2 hidden min-w-0 flex-1 items-center justify-evenly gap-1 lg:flex"
            onMouseLeave={() => setHovered(null)}
          >
            {LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              const dotHere = (hovered ?? (active ? link.href : null)) === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => setHovered(link.href)}
                  /* shrink-0 + whitespace-nowrap：CJK 在窄宽度下会按字换行（首/页 两行），
                     强制不换行并保持链接宽度；空间不够时由中间的搜索框先压缩。 */
                  className={`relative shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-base transition-colors ${
                    active
                      ? "text-accent-gradient font-semibold"
                      : "text-muted hover-text-accent"
                  }`}
                >
                  <span className="relative z-10 flex items-center justify-center gap-1 whitespace-nowrap">
                    {/* 绿点 = 「此刻正在发生」（状态），只挂在音乐且有歌在放时；
                        位置语义已由渐变文字 + 光标点承担，不再需要白点。 */}
                    {link.href === "/music" && playing && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0" title={t("nav.musicPlaying")}>
                        <span className="live-ring absolute inset-0 rounded-full bg-emerald-400" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                      </span>
                    )}
                    {t(link.key)}
                  </span>
                  {dotHere && (
                    /* 外层只做位移（layoutId 弹簧滑到目标链接下居中），
                       内层做呼吸动画，两层 transform 互不打架 */
                    <motion.span
                      layoutId="navbar-cursor"
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
                    >
                      <span className="nav-cursor-dot h-1 w-1 rounded-full bg-accent-solid" />
                    </motion.span>
                  )}
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
              <label className="flex w-52 items-center gap-2 rounded-full border border-white/30 bg-white/35 px-3 py-1.5 backdrop-blur-md transition-colors focus-within:border-indigo-400/70 focus-within:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:focus-within:bg-white/10">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goSearch()}
                  placeholder={t("nav.searchPlaceholder")}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted/70"
                />
                {/* 快捷键角标：点击唤起命令面板。修饰键按平台显示，
                    挂载后再判定，避免 SSR/客户端不一致 */}
                {shortcutKey && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event("cl-open-search"))}
                    aria-label={t("search.title")}
                    title={t("search.title")}
                    className="shrink-0 rounded border border-[var(--glass-border)] px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:text-accent"
                  >
                    {shortcutKey}
                  </button>
                )}
              </label>
            </div>
            <div className="hidden md:block"><CalendarPopover /></div>
            <LanguageSwitcher />
            <div ref={themeWrapRef} className="relative">
              <button
                onClick={() => setThemeOpen((v) => !v)}
                aria-label={t("nav.themeMode")}
                aria-expanded={themeOpen}
                className="glass-button !rounded-full !p-2.5"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={mode}
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex"
                  >
                    {mode === "system" ? (
                      <Monitor className="h-4 w-4" />
                    ) : theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>
              <AnimatePresence>
                {themeOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="glass-card absolute right-0 top-12 z-50 w-36 p-1.5"
                  >
                    {(
                      [
                        ["light", Sun, "tools.themeLight"],
                        ["dark", Moon, "tools.themeDark"],
                        ["system", Monitor, "tools.themeSystem"],
                      ] as const
                    ).map(([m, Icon, labelKey]) => (
                      <button
                        key={m}
                        onClick={() => {
                          setMode(m);
                          setThemeOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          mode === m
                            ? "bg-accent-soft font-semibold text-accent"
                            : "text-muted hover:bg-white/40 dark:hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {t(labelKey)}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
