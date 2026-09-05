"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCog, Check, ChevronDown } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import type { AiProvider } from "@/lib/site";
import type { ThinkingLevel } from "@/lib/llm-thinking";
import { BrandLogo } from "./BrandLogo";
import { PersonaFull } from "./PersonaArt";

/**
 * 模型与思考强度选择器（/chat 页）：
 * - 触发胶囊显示当前 logo + 模型名 + 档位；点开玻璃弹窗
 * - 弹窗左侧模型列表（真实模型 id），右侧当前模型拟人立绘（低/高思考两版随档位切换）
 * - 思考强度滑条按该模型真实档位渲染刻度（不同模型档位数不同）
 * - 选择写入 localStorage：cl-chat-model / cl-chat-effort:<id> / cl-chat-provider，
 *   悬浮窗共用 useChat，自动跟随同一选择
 */

export interface PickerChoice {
  id: string;
  label: string;
  provider: AiProvider;
  /** 服务端解析后的真实模型名（展示用） */
  model: string;
  /** 该模型支持的思考档位（弱→强） */
  levels: ThinkingLevel[];
}

export interface AiChoicesPublic {
  allow: boolean;
  defaultChoice: string;
  defaultEffort: string;
  choices: PickerChoice[];
}

export const MODEL_STORAGE_KEY = "cl-chat-model";
export const PROVIDER_STORAGE_KEY = "cl-chat-provider";
export const effortStorageKey = (choiceId: string) => `cl-chat-effort:${choiceId}`;

/** 读某模型当前档位：localStorage 存档 → 配置默认档 → 首档（钳制在该模型档位内） */
export function readEffort(choice: PickerChoice, defaultEffort: string): ThinkingLevel {
  const stored = localStorage.getItem(effortStorageKey(choice.id));
  if (stored && choice.levels.includes(stored as ThinkingLevel)) return stored as ThinkingLevel;
  if (choice.levels.includes(defaultEffort as ThinkingLevel)) return defaultEffort as ThinkingLevel;
  return choice.levels[0]!;
}

export function ModelPicker({ aiChoices }: { aiChoices: AiChoicesPublic }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState("");
  const [effort, setEffort] = useState<ThinkingLevel>("off");
  const rootRef = useRef<HTMLDivElement>(null);

  // 初始化：恢复上次选择（无效则回退后台默认），并回写 provider 供悬浮窗头像兜底
  useEffect(() => {
    if (!aiChoices.choices.length) return;
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    const hit = aiChoices.choices.find((c) => c.id === stored);
    const choice = hit ?? aiChoices.choices.find((c) => c.id === aiChoices.defaultChoice) ?? aiChoices.choices[0]!;
    setModelId(choice.id);
    setEffort(readEffort(choice, aiChoices.defaultEffort));
    localStorage.setItem(MODEL_STORAGE_KEY, choice.id);
    localStorage.setItem(PROVIDER_STORAGE_KEY, choice.provider);
  }, [aiChoices]);

  // 外点 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choice = aiChoices.choices.find((c) => c.id === modelId) ?? aiChoices.choices[0];

  if (!choice) return null;

  const selectModel = (c: PickerChoice) => {
    setModelId(c.id);
    const lv = readEffort(c, aiChoices.defaultEffort);
    setEffort(lv);
    localStorage.setItem(MODEL_STORAGE_KEY, c.id);
    localStorage.setItem(PROVIDER_STORAGE_KEY, c.provider);
    localStorage.setItem(effortStorageKey(c.id), lv);
  };

  const setLevel = (lv: ThinkingLevel) => {
    setEffort(lv);
    localStorage.setItem(effortStorageKey(choice.id), lv);
  };

  const levelIndex = choice.levels.indexOf(effort);

  return (
    <div ref={rootRef} className="relative">
      {/* 触发胶囊 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="glass-button flex min-w-0 items-center gap-1.5 !rounded-full !px-2 !py-1 text-xs"
        aria-label={t("chat.modelLabel")}
      >
        <BrandLogo provider={choice.provider} size={18} />
        <span className="max-w-36 truncate font-medium">{choice.label}</span>
        <span className="hidden text-muted sm:inline">·</span>
        <span className="hidden text-muted sm:inline">{t(`chat.level.${effort}`)}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card absolute bottom-full left-0 z-30 mb-2 w-[min(21rem,calc(100vw-3rem))] !rounded-2xl p-3 shadow-xl"
          >
            {/* 上：模型列表 + 当前模型立绘 */}
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <p className="px-1 pb-1.5 text-[0.625rem] font-semibold tracking-widest text-muted">
                  {t("chat.sectionModel")}
                </p>
                <div className="space-y-1">
                  {aiChoices.choices.map((c) => {
                    const active = c.id === choice.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectModel(c)}
                        className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors ${
                          active
                            ? "bg-accent-soft"
                            : "hover:bg-white/50 dark:hover:bg-white/10"
                        }`}
                      >
                        <BrandLogo provider={c.provider} size={22} />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-xs font-medium ${active ? "text-accent" : ""}`}>
                            {c.label}
                          </span>
                          <span className="block truncate font-mono text-[0.625rem] text-muted">{c.model}</span>
                        </span>
                        {active && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* 立绘：低思考=悠闲版，中高=认真版；素材缺失自动隐藏 */}
              <div className="flex w-[5.5rem] shrink-0 items-start justify-center overflow-hidden rounded-xl bg-gradient-to-b from-white/40 to-transparent pt-1 dark:from-white/10">
                <PersonaFull provider={choice.provider} level={effort} />
              </div>
            </div>

            {/* 下：思考强度滑条（按该模型真实档位） */}
            <div className="mt-2 border-t border-[var(--glass-border)] pt-2.5">
              <div className="flex items-center justify-between pb-1.5">
                <p className="flex items-center gap-1 text-[0.625rem] font-semibold tracking-widest text-muted">
                  <BrainCog className="h-3 w-3" />
                  {t("chat.sectionEffort")}
                </p>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.625rem] font-semibold text-accent">
                  {t(`chat.level.${effort}`)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(choice.levels.length - 1, 0)}
                step={1}
                value={Math.max(levelIndex, 0)}
                onChange={(e) => setLevel(choice.levels[Number(e.target.value)] ?? choice.levels[0]!)}
                className="cl-effort-range w-full"
                style={
                  {
                    "--fill": `${(Math.max(levelIndex, 0) / Math.max(choice.levels.length - 1, 1)) * 100}%`,
                  } as CSSProperties
                }
                aria-label={t("chat.sectionEffort")}
              />
              <div
                className="grid pt-0.5 text-center"
                style={{ gridTemplateColumns: `repeat(${choice.levels.length}, minmax(0, 1fr))` }}
              >
                {choice.levels.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setLevel(lv)}
                    className={`text-[0.625rem] transition-colors ${
                      lv === effort ? "font-semibold text-accent" : "text-muted hover:text-accent"
                    }`}
                  >
                    {t(`chat.level.${lv}`)}
                  </button>
                ))}
              </div>
              <p className="pt-1 text-[0.625rem] leading-relaxed text-muted">{t("chat.effortHint")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
