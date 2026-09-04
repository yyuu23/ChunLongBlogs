"use client";

import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/components/providers/LocaleProvider";

/** 设置面板区块壳：accent 竖条标题 + 值为默认时自动隐藏的「恢复默认」（Firefly 模式） */
export function PanelSection({
  title,
  isDefault = true,
  onReset,
  children,
}: {
  title: string;
  /** 值等于默认时按钮 opacity-0 + 禁点击，避免常驻噪音 */
  isDefault?: boolean;
  onReset?: () => void;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <section className="mb-4 last:mb-0">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted">
          <span className="h-3.5 w-1 rounded-full bg-accent-gradient" aria-hidden />
          {title}
        </p>
        {onReset && (
          <button
            onClick={onReset}
            aria-label={t("tools.resetAria")}
            title={t("tools.reset")}
            className={`flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] text-muted transition-all hover:bg-white/40 hover:text-accent dark:hover:bg-white/10 ${
              isDefault ? "pointer-events-none opacity-0" : "opacity-80"
            }`}
          >
            <RotateCcw className="h-3 w-3" />
            {t("tools.reset")}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
