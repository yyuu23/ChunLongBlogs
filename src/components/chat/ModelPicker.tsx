"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCog, Check, ChevronDown } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import type { AiProvider } from "@/lib/site";
import type { ThinkingLevel } from "@/lib/llm-thinking";
import { BrandLogo } from "./BrandLogo";
import { PersonaFull, preheatPersona } from "./PersonaArt";
import { CreditIcon } from "./CreditIcon";
import { fetchProgress } from "@/lib/track";
import { isDeepSeekPeakNow, peakMultiplierOf } from "@/lib/credits";

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
  /** 每条消息基准积分（✦） */
  cost: number;
  /** 各档位实际积分价（档位 id → 分） */
  levelCosts: Record<string, number>;
  /** 限时促销展示（划线原价；until 过期自动隐藏） */
  promo?: { originalCost?: number; label?: string; until?: string };
}

export interface AiChoicesPublic {
  allow: boolean;
  defaultChoice: string;
  defaultEffort: string;
  choices: PickerChoice[];
  /** 积分体系：enabled=false 时选择器不显示价格元素 */
  credits: { enabled: boolean; dailyGrant: number; peakMultiplier?: number };
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
  /** 每个模型各自的记忆档位（行价按它显示；localStorage 恢复 + 选择/拖动时更新） */
  const [efforts, setEfforts] = useState<Record<string, ThinkingLevel>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  // 初始化：恢复上次选择（无效则回退后台默认），并回写 provider 供悬浮窗头像兜底；
  // 同时把所有模型的记忆档位一次性读出（行价按各自档位显示）
  useEffect(() => {
    if (!aiChoices.choices.length) return;
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    const hit = aiChoices.choices.find((c) => c.id === stored);
    const choice = hit ?? aiChoices.choices.find((c) => c.id === aiChoices.defaultChoice) ?? aiChoices.choices[0]!;
    setModelId(choice.id);
    setEffort(readEffort(choice, aiChoices.defaultEffort));
    setEfforts(Object.fromEntries(
      aiChoices.choices.map((c) => [c.id, readEffort(c, aiChoices.defaultEffort)]),
    ));
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

  // 预热当前模型的拟人图（~55KB，浏览器缓存）：打开弹窗/切档位基本秒出
  const provider = choice?.provider;
  useEffect(() => {
    if (provider) preheatPersona(provider);
  }, [provider]);

  // 积分余额：初始拉取 + 订阅实时刷新（对话扣减/每日签到发放都会广播）
  const [credits, setCredits] = useState<number | null>(null);
  useEffect(() => {
    if (!aiChoices.credits.enabled) return;
    void fetchProgress().then((p) => p && setCredits(p.credits));
    const onCredits = (e: Event) => {
      const v = (e as CustomEvent<{ credits?: number }>).detail?.credits;
      if (typeof v === "number") setCredits(v);
    };
    window.addEventListener("cl-credits-update", onCredits);
    window.addEventListener("cl-player-update", onCredits);
    return () => {
      window.removeEventListener("cl-credits-update", onCredits);
      window.removeEventListener("cl-player-update", onCredits);
    };
  }, [aiChoices.credits.enabled]);

  // DeepSeek 高峰判定：每 30s 重估一次（跨过 9:00/12:00/14:00/18:00 时提示自动出现/消失）。
  // 高峰加价只作用于 DeepSeek 自己的行——其它模型的积分与高峰无关
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((v) => v + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const peakTime = aiChoices.credits.enabled && isDeepSeekPeakNow();
  const isDeepSeekSel = choice?.provider === "deepseek";
  const peakActive = peakTime && isDeepSeekSel;
  const peakMult = peakMultiplierOf(aiChoices as unknown as Parameters<typeof peakMultiplierOf>[0]);
  const todayStr = new Date().toISOString().slice(0, 10);
  /** 行显示价：
   *  - 每行按它自己的记忆档位显示价格（选中行跟随滑条，未选中行静止在它上次选的档位）
   *  - DeepSeek 行在高峰时段一律 ×高峰倍率（无论是否选中——高峰期它的真实成本就是双倍） */
  const rowLevel = (c: PickerChoice): ThinkingLevel =>
    efforts[c.id] ?? (c.id === choice?.id ? effort : c.levels[0]!);
  const displayCost = (c: PickerChoice) => {
    const lv = rowLevel(c);
    const base = c.levelCosts[lv] ?? c.cost;
    return Math.round(base * (peakTime && c.provider === "deepseek" ? peakMult : 1));
  };
  /** 促销划线原价：按该行显示档位等比缩放（折扣比例每档成立） */
  const promoStrike = (c: PickerChoice) => {
    if (!c.promo?.originalCost) return null;
    const lv = rowLevel(c);
    return Math.round(c.promo.originalCost * ((c.levelCosts[lv] ?? c.cost) / c.cost));
  };
  const promoOn = (c: PickerChoice) => !!c.promo && (!c.promo.until || c.promo.until >= todayStr);

  if (!choice) return null;

  const selectModel = (c: PickerChoice) => {
    setModelId(c.id);
    const lv = readEffort(c, aiChoices.defaultEffort);
    setEffort(lv);
    setEfforts((m) => ({ ...m, [c.id]: lv }));
    localStorage.setItem(MODEL_STORAGE_KEY, c.id);
    localStorage.setItem(PROVIDER_STORAGE_KEY, c.provider);
    localStorage.setItem(effortStorageKey(c.id), lv);
  };

  const setLevel = (lv: ThinkingLevel) => {
    setEffort(lv);
    setEfforts((m) => ({ ...m, [choice.id]: lv }));
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
            className="glass-card cl-model-popup absolute bottom-full left-0 z-30 mb-2 w-[min(24rem,calc(100vw-3rem))] !rounded-2xl p-3 shadow-xl"
          >
            {/* DeepSeek 高峰时段警示（仅选中 DeepSeek 且处于高峰时出现） */}
            {peakActive && (
              <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-amber-300/60 bg-amber-100/70 px-2.5 py-1.5 text-[0.625rem] font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                ⚡ {t("chat.peakNotice")}
              </div>
            )}
            {/* 上：模型列表 + 当前模型立绘 */}
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <p className="text-[0.625rem] font-semibold tracking-widest text-muted">
                    {t("chat.sectionModel")}
                  </p>
                  {aiChoices.credits.enabled && credits !== null && (
                    <span
                      title={t("chat.creditsBalance")}
                      className="flex items-center gap-1 rounded-full bg-white/50 px-2 py-0.5 text-[0.625rem] font-semibold tabular-nums text-muted dark:bg-white/10"
                    >
                      <CreditIcon size={10} />
                      {credits}
                    </span>
                  )}
                </div>
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
                        {aiChoices.credits.enabled && (
                          <span
                            title={t("chat.creditsPerMsg")}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-black/5 px-1.5 py-0.5 text-[0.625rem] tabular-nums text-muted dark:bg-white/10"
                          >
                            {promoOn(c) && (
                              <>
                                {c.promo?.label && (
                                  <span className="rounded-full bg-rose-400/15 px-1 text-rose-500 dark:text-rose-300">
                                    {c.promo.label}
                                  </span>
                                )}
                                {!!promoStrike(c) && <s className="opacity-60">{promoStrike(c)}</s>}
                              </>
                            )}
                            <CreditIcon size={10} />
                            {displayCost(c)}
                          </span>
                        )}
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
                <div className="flex items-center gap-1.5">
                  {aiChoices.credits.enabled && (
                    <span
                      title={t("chat.creditsPerMsg")}
                      className="flex items-center gap-0.5 text-[0.625rem] tabular-nums text-muted"
                    >
                      <CreditIcon size={10} />−{displayCost(choice)}
                    </span>
                  )}
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.625rem] font-semibold text-accent">
                    {t(`chat.level.${effort}`)}
                  </span>
                </div>
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
