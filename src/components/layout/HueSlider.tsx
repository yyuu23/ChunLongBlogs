"use client";

import { useAccent } from "@/components/providers/AccentProvider";
import { useT } from "@/components/providers/LocaleProvider";
import { trackEvent } from "@/lib/track";

/**
 * 360° 色相滑杆：轨道本身就是色相刻度（彩虹渐变），拖动即写 --custom-hue
 * 实时换肤（CSS 变量更新成本极低，无需 debounce）。
 * 选预设时半透明弱化，一拖立即回到 custom 态。
 * 埋点只在松手/键盘松开时上报 —— onChange 拖动中每帧触发，直接埋会刷爆请求。
 */
export function HueSlider() {
  const { accent, customHue, setCustomHue } = useAccent();
  const t = useT();
  return (
    <div className={accent === "custom" ? "" : "opacity-50 transition-opacity"}>
      <p className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
        {t("tools.customHue")}
        <span className="tabular-nums">{Math.round(customHue)}°</span>
      </p>
      <input
        type="range"
        min={0}
        max={360}
        step={1}
        value={customHue}
        onChange={(e) => setCustomHue(parseInt(e.target.value, 10))}
        onPointerUp={() => trackEvent("set_custom_hue", { hue: customHue })}
        onKeyUp={() => trackEvent("set_custom_hue", { hue: customHue })}
        aria-label={t("tools.customHue")}
        className="hue-slider"
        style={{ "--hue-thumb": `hsl(${customHue} 75% 52%)` } as React.CSSProperties}
      />
    </div>
  );
}
