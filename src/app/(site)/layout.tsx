import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/layout/BackgroundLayer";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { FloatingTools } from "@/components/layout/FloatingTools";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { ThemeParticles, ClickEffect } from "@/components/effects/Effects";
import { SelectionSparkle } from "@/components/effects/SelectionSparkle";
import { ReadingProgress } from "@/components/posts/ReadingProgress";
import { PlayerProvider } from "@/components/music/PlayerProvider";
import { getSiteConfig } from "@/lib/site";

/** 公开站点布局：背景三明治 + 粒子 + 导航 + 页脚 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const config = await getSiteConfig();

  return (
    <>
      <BackgroundLayer
        mode={config.bgMode}
        images={config.bgImages}
        palette={config.gradientPalette}
      />
      <ThemeParticles />
      <ClickEffect />
      <SelectionSparkle />
      <ReadingProgress />
      <SplashScreen siteName={config.siteName} avatar={config.avatar} />

      <Navbar siteName={config.siteName} avatar={config.avatar} />

      <PlayerProvider>
        <main className="relative z-10 flex-1 pt-20 md:pt-24">{children}</main>
        <Footer config={config} />
      </PlayerProvider>

      <MobileTabBar />
      <FloatingTools />
    </>
  );
}
