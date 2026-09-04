"use client";

import { useEffect, useState } from "react";
import { PanelSection } from "@/components/layout/PanelSection";
import { useT } from "@/components/providers/LocaleProvider";

const OPTIONS = [15, 17, 19] as const;
const DEFAULT = 17;
const LS_KEY = "cl-font-size";

/**
 * 全站字体大小三档：改 <html> 根字号即宏观等比缩放（Tailwind 的 rem 单位
 * 全部跟随，模块间层次不变）。CSS 直改即时生效、无需 Provider/全站重渲染；
 * 访客选择写 cl-font-size（initScript 首帧恢复，防闪）。
 */
export function FontSizeSection() {
  const t = useT();
  const [cur, setCur] = useState<number>(DEFAULT);

  // 挂载后读访客选择（无记录 = CSS 默认 17px）
  useEffect(() => {
    const v = parseInt(localStorage.getItem(LS_KEY) ?? "", 10);
    if ((OPTIONS as readonly number[]).includes(v)) setCur(v);
  }, []);

  const set = (px: number) => {
    setCur(px);
    document.documentElement.style.fontSize = `${px}px`;
    try {
      localStorage.setItem(LS_KEY, String(px));
    } catch {}
  };

  const labels = ["tools.fontCompact", "tools.fontCozy", "tools.fontLarge"];

  return (
    <PanelSection
      title={t("tools.fontSize")}
      isDefault={cur === DEFAULT}
      onReset={() => set(DEFAULT)}
    >
      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((px, i) => (
          <button
            key={px}
            onClick={() => set(px)}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-all ${
              cur === px
                ? "bg-accent-gradient font-semibold text-white shadow"
                : "text-muted hover:bg-white/40 dark:hover:bg-white/10"
            }`}
          >
            {/* 用该档真实字号渲染示例字，所见即所得 */}
            <span style={{ fontSize: `${px}px`, lineHeight: 1 }}>字 A</span>
            {t(labels[i] ?? "tools.fontCozy")}
          </button>
        ))}
      </div>
    </PanelSection>
  );
}
