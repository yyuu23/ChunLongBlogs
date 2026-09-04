"use client";

import Image from "next/image";
import { RefreshCw } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { useWallpaper } from "@/components/providers/WallpaperProvider";
import { trackEvent } from "@/lib/track";
import { SettingSlider } from "@/components/layout/SettingSlider";

/**
 * 背景图片区块内容：缩略图网格（第 1 格 = 自动轮播，其余为后台壁纸）+
 * 遮罩浓度 / 磨砂模糊滑杆。缩略图走 next/image 优化（remotePatterns 已放行
 * 远程图床，AVIF/WebP + 磁盘缓存），面板点开才加载、不进首屏。
 */
export function WallpaperPicker() {
  const { server, prefs, effective, setPrefs } = useWallpaper();
  const t = useT();

  if (server.mode !== "image") return null;

  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {/* 自动轮播格：与缩略图同为单选语义 */}
        <button
          onClick={() => setPrefs({ pick: "auto" })}
          className={`flex aspect-[16/10] flex-col items-center justify-center gap-1 rounded-lg text-[10px] transition-all ${
            prefs.pick === "auto"
              ? "bg-accent-gradient font-semibold text-white shadow"
              : "bg-white/30 text-muted hover:bg-white/50 dark:bg-white/10 dark:hover:bg-white/20"
          }`}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("tools.wallpaperAuto")}
        </button>
        {server.images.map((src, i) => (
          <button
            key={src + i}
            onClick={() => {
              trackEvent("pick_wallpaper", { index: i });
              setPrefs({ pick: i });
            }}
            aria-label={t("tools.wallpaperAria", { index: i + 1 })}
            className={`relative aspect-[16/10] overflow-hidden rounded-lg transition-all ${
              prefs.pick === i
                ? "ring-2 ring-accent-solid"
                : "opacity-75 hover:opacity-100"
            }`}
          >
            <Image src={src} alt="" fill sizes="96px" className="object-cover" />
          </button>
        ))}
      </div>

      <SettingSlider
        label={t("tools.maskOpacity")}
        value={effective.maskOpacity}
        min={0}
        max={0.8}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => setPrefs({ mask: v })}
      />
      <SettingSlider
        label={t("tools.maskBlur")}
        value={effective.maskBlur}
        min={0}
        max={24}
        step={1}
        format={(v) => `${v}px`}
        onChange={(v) => setPrefs({ blur: v })}
      />
      {/* 固定某张壁纸时没有切换概念，滑杆随之隐藏 */}
      {prefs.pick === "auto" && (
        <SettingSlider
          label={t("tools.switchInterval")}
          value={effective.intervalS}
          min={10}
          max={120}
          step={5}
          format={(v) => `${v}s`}
          onChange={(v) => setPrefs({ intervalS: v })}
        />
      )}
    </>
  );
}
