"use client";

import type { CSSProperties } from "react";

/**
 * 通用设置滑杆：label + 当前值 + 进度填充。
 * 已走过部分着 accent 色（--range-progress 变量，样式在 globals.css .setting-slider），
 * Firefly 的滑杆填充模式。
 */
export function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** 值显示格式化（如 15% / 6px） */
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <label className="mb-2.5 block last:mb-0">
      <span className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
        {label}
        <span className="tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        className="setting-slider"
        style={{ "--range-progress": `${pct}%` } as CSSProperties}
      />
    </label>
  );
}
