import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { ThemeProvider, themeInitScript } from "@/components/providers/ThemeProvider";
import { EffectProvider } from "@/components/providers/EffectProvider";
import { getSiteConfig } from "@/lib/site";

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

/** 首帧脚本：主题初始化 + 启动屏"已看过"判断，避免闪烁 */
const initScript = `
${themeInitScript}
(function(){try{
  var seen = sessionStorage.getItem('cl-splash-seen')==='1';
  var eff = localStorage.getItem('cl-effects');
  var splashOn = eff ? (JSON.parse(eff).splash !== false) : true;
  if(seen || !splashOn || matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.documentElement.classList.add('splash-seen');
  }
}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
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
        <ThemeProvider>
          <EffectProvider>{children}</EffectProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
