import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { EffectProvider } from "@/components/providers/EffectProvider";
import { AccentProvider } from "@/components/providers/AccentProvider";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { getSiteConfig } from "@/lib/site";
import { getLocale } from "@/lib/i18n/server";
import { HTML_LANG } from "@/lib/i18n/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    title: {
      default: config.siteName,
      template: `%s · ${config.siteName}`,
    },
    description: config.siteDescription,
    openGraph: {
      title: config.siteName,
      description: config.siteDescription,
      type: "website",
    },
  };
}

/** Android/Chrome 软键盘弹出时压缩 layout viewport（配合 dvh，聊天页输入框不被遮挡） */
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

/** 首帧脚本：主题初始化（localStorage/系统偏好）+ 启动屏"已看过"判断，避免闪烁 */
const initScript = `
(function(){try{
  var t = localStorage.getItem('cl-theme');
  if(!t){ t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
  if(t === 'dark'){ document.documentElement.classList.add('dark'); }
  document.documentElement.style.colorScheme = t;
}catch(e){}})();
(function(){try{
  var a = localStorage.getItem('cl-accent');
  if(a){ document.documentElement.dataset.accent = a; }
}catch(e){}})();
(function(){try{
  var seen = sessionStorage.getItem('cl-splash-seen')==='1';
  var eff = localStorage.getItem('cl-effects');
  var splashOn = eff ? (JSON.parse(eff).splash !== false) : true;
  if(seen || !splashOn || matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.documentElement.classList.add('splash-seen');
  }
}catch(e){}})();
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={HTML_LANG[locale]}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerifSC.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
        <noscript>
          <style>{`.splash-overlay{display:none !important}`}</style>
        </noscript>
      </head>
      <body className="min-h-dvh">
        <LocaleProvider initialLocale={locale}>
          <ThemeProvider>
            <AccentProvider>
              <EffectProvider>{children}</EffectProvider>
            </AccentProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
