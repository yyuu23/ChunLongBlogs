import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/layout/BackgroundLayer";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { FloatingTools } from "@/components/layout/FloatingTools";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { ThemeParticles, ClickEffect } from "@/components/effects/Effects";
import { SelectionSparkle } from "@/components/effects/SelectionSparkle";
import { BottleProjection } from "@/components/effects/BottleProjection";
import { AchievementToasts } from "@/components/effects/AchievementToasts";
import { ReadingProgress } from "@/components/posts/ReadingProgress";
import { PlayerProvider } from "@/components/music/PlayerProvider";
import { Mascot } from "@/components/mascot/Mascot";
import { ChatWidget } from "@/components/mascot/ChatWidget";
import { ProactiveChat } from "@/components/mascot/ProactiveChat";
import { SearchPalette } from "@/components/layout/SearchPalette";
import { WallpaperProvider } from "@/components/providers/WallpaperProvider";
import { VisitBeacon } from "@/components/VisitBeacon";
import { getSiteConfig } from "@/lib/site";

/** 公开站点布局：背景三明治 + 粒子 + 导航 + 页脚 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const config = await getSiteConfig();

  return (
    /* WallpaperProvider：后台背景配置为默认值，访客在设置面板本地覆盖
     * （选中某张壁纸 / 遮罩浓度 / 磨砂模糊），BackgroundLayer 与 FloatingTools 都从这取数 */
    <WallpaperProvider
      server={{
        mode: config.bgMode,
        images: config.bgImages,
        palette: config.gradientPalette,
        maskOpacity: config.bgMaskOpacity,
        maskBlur: config.bgMaskBlur,
      }}
    >
      <BackgroundLayer />
      <ThemeParticles />
      {/* 深夜模式夜幕层：0-4 点由 cl-night 类点亮（initScript 首帧 + EffectProvider 轮询），只压暗背景与粒子 */}
      <div className="cl-night-overlay" aria-hidden />
      <ClickEffect />
      <SelectionSparkle />
      {/* 瓶子投影仪：把漂流瓶里的季节释放在全站（cl-bottle-project 事件触发） */}
      <BottleProjection />
      <ReadingProgress />
      <SplashScreen siteName={config.siteName} avatar={config.avatar} />

      <Navbar siteName={config.siteName} avatar={config.avatar} />
      {/* ⌘K / Ctrl+K 全站搜索（Navbar 点搜索框也会派发 cl-open-search 唤起） */}
      <SearchPalette />

      <PlayerProvider>
        <main className="relative z-10 flex-1 pt-20 md:pt-24">{children}</main>
        <Footer config={config} />
      </PlayerProvider>

      <MobileTabBar />
      <FloatingTools />
      <Mascot />
      <ChatWidget />
      <ProactiveChat />
      <AchievementToasts />
      {/* PV/UV 埋点（路由变化上报，30s 同路径去重） */}
      <VisitBeacon />
    </WallpaperProvider>
  );
}
