"use client";

import { useState, useTransition, useRef } from "react";
import { Bot, BrainCog, Loader2, Plus, RotateCcw, Sparkles, Trash2, Undo2, Wrench } from "lucide-react";
import { saveAiChat } from "@/app/admin/actions";
import type { AiChatChoice, AiChatConfig, AiCustomTool, AiProvider } from "@/lib/site";
import { thinkingSpec, type ThinkingLevel } from "@/lib/llm-thinking";
import { EFFORT_COST_DEFAULTS, creditsCfg } from "@/lib/credits";

const input =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400";
const label = "text-xs font-medium text-slate-500";

const PROVIDER_LABELS: Record<AiProvider, string> = {
  deepseek: "DeepSeek",
  glm: "GLM（智谱）",
  qwen: "Qwen（阿里云）",
};

/** 档位的中文短标（admin 为中文后台，不走 i18n） */
const LEVEL_LABELS: Record<ThinkingLevel, string> = {
  off: "无",
  low: "低",
  mid: "中",
  high: "高",
  max: "最高",
  on: "开",
};

/** 内置工具清单（能力管理开关用） */
const BUILTIN_TOOLS: { name: string; label: string; desc: string }[] = [
  { name: "list_posts", label: "查询文章列表", desc: "AI 能实时查站内文章" },
  { name: "get_post", label: "读取文章内容", desc: "AI 能读某篇文章全文做总结" },
  { name: "list_moments", label: "查询最近说说", desc: "AI 能查站长的说说动态" },
  { name: "list_albums", label: "查询相册", desc: "AI 能查相册与照片信息" },
  { name: "site_stats", label: "查询站点统计", desc: "AI 能报文章数/字数等统计" },
  { name: "list_music", label: "查询音乐馆", desc: "AI 能查歌单与歌曲" },
  { name: "web_search", label: "联网搜索", desc: "Tavily 实时搜索（还需 .env 配置 key）" },
];

/**
 * AI 对话管理表单：模型预设（含牌价换算/促销）/ 默认模型与思考强度 / 访客选择开关 / AI 积分。
 * （旧的每访客次数限制已移除——积分开启时天然限速；关闭积分时按已存配置回退生效）
 * 供应商 Key 只认 .env——这里未配 key 的供应商，其预设对访客自动隐藏（仅作保留）。
 * 思考档位由供应商与模型代际自动推断（llm-thinking.ts），与前台滑条一致。
 */
export function AiChatManager({
  initial,
  providers,
  envDefault,
  resolvedModels,
  defaults,
}: {
  initial: AiChatConfig;
  providers: Record<AiProvider, boolean>;
  envDefault: AiProvider;
  /** 各供应商解析后的真实默认模型（预设未填覆盖时，档位按它计算） */
  resolvedModels: Record<AiProvider, string>;
  /** 内置默认预设（「恢复默认」用，服务端从 DEFAULT_SITE_CONFIG 传入避免客户端引 db 模块） */
  defaults: { choices: AiChatChoice[]; defaultChoice: string; defaultEffort: string };
}) {
  const [pending, startTransition] = useTransition();
  const [cfg, setCfg] = useState(initial);
  const [message, setMessage] = useState("");
  // 积分配置视图（cfg.credits 缺字段时 creditsCfg 补默认值）
  const cr = creditsCfg(cfg);

  /* ===== 每日预算换算器：1 元 = 1000 积分，就近取整到 50（大额 100）的倍数 ===== */
  const CREDIT_RATE = 1000;
  const [budgetYuan, setBudgetYuan] = useState("");
  const prevGrantRef = useRef<number | null>(null);
  const convertedGrant = (() => {
    const v = Number(budgetYuan);
    if (!Number.isFinite(v) || v <= 0) return null;
    const raw = v * CREDIT_RATE;
    return raw >= 1000 ? Math.round(raw / 100) * 100 : Math.round(raw / 50) * 50;
  })();
  const applyBudget = () => {
    if (convertedGrant === null) return;
    prevGrantRef.current = cr.dailyGrant;
    set("credits", { ...cr, dailyGrant: convertedGrant });
  };
  const undoBudget = () => {
    if (prevGrantRef.current === null) return;
    set("credits", { ...cr, dailyGrant: prevGrantRef.current });
    prevGrantRef.current = null;
    setBudgetYuan("");
  };
  const budgetApplied = prevGrantRef.current !== null;

  /* ===== API 牌价换算：按官方 元/百万tokens 牌价自动算基准积分 =====
   * 建议积分 = ⌈(预估输入×(50%×缓存价+50%×输入价) + 预估输出×输出倍数×输出价) ÷ 1M
   *            × 1000积分/元 × 加价倍数⌉；缓存价留空按 0% 命中；只写 cost，扣费口径不变 */
  const markup = cr.pricingMarkup ?? 2;
  const estIn = cr.estInputTokens ?? 4000;
  const estOut = cr.estOutputTokens ?? 1000;
  const apiPriceSuggest = (c: AiChatChoice): number | null => {
    const p = c.apiPrice;
    if (!p?.input || !p?.output) return null;
    const inPrice = p.cache ? 0.5 * p.cache + 0.5 * p.input : p.input;
    const costYuan = (estIn * inPrice + estOut * (p.outputMult ?? 1) * p.output) / 1_000_000;
    return Math.max(1, Math.ceil(costYuan * 1000 * markup));
  };

  /* ===== 档位倍率输入：允许一位小数（1.5 ✓ / 1.25 ✗）=====
   * 草稿态保证 "1." 这类中间态能正常输入（受控 number 输入会把小数点吃掉）；
   * 两位小数等非法输入直接忽略；最终扣费时服务端向下取整为整数积分。 */
  const [effortDraft, setEffortDraft] = useState<Partial<Record<ThinkingLevel, string>>>({});
  const updateEffort = (lv: ThinkingLevel, raw: string) => {
    const clean = raw.replace(/[^\d.]/g, "").slice(0, 6);
    if (!/^\d{0,3}(\.\d?)?$/.test(clean)) return;
    setEffortDraft((d) => ({ ...d, [lv]: clean }));
    set("effortCost", {
      ...(cfg.effortCost ?? {}),
      [lv]: clean === "" || clean.endsWith(".") ? undefined : Math.max(0, Math.min(999, parseFloat(clean))),
    });
  };
  const clearEffortDraft = (lv: ThinkingLevel) =>
    setEffortDraft((d) => {
      const next = { ...d };
      delete next[lv];
      return next;
    });

  const set = <K extends keyof typeof cfg>(key: K, value: (typeof cfg)[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const updateChoice = (i: number, patch: Partial<AiChatChoice>) =>
    setCfg((c) => ({
      ...c,
      choices: c.choices.map((ch, j) => (j === i ? { ...ch, ...patch } : ch)),
    }));

  const addChoice = () =>
    setCfg((c) => ({
      ...c,
      choices: [
        ...c.choices,
        {
          id: `custom-${Date.now().toString(36)}`,
          label: "新模型",
          provider: envDefault,
        },
      ],
    }));

  const removeChoice = (i: number) => {
    const removed = cfg.choices[i];
    setCfg((c) => ({
      ...c,
      choices: c.choices.filter((_, j) => j !== i),
      // 删掉的是默认时，默认顺延到第一项
      defaultChoice: removed?.id === c.defaultChoice ? (c.choices.filter((_, j) => j !== i)[0]?.id ?? "") : c.defaultChoice,
    }));
  };

  const resetDefaults = () =>
    setCfg((c) => ({
      ...c,
      choices: defaults.choices.map((ch) => ({ ...ch })),
      defaultChoice: defaults.defaultChoice,
      defaultEffort: defaults.defaultEffort,
    }));

  const toggleTool = (name: string, on: boolean) =>
    setCfg((c) => ({ ...c, tools: { ...(c.tools ?? {}), [name]: on } }));

  const updateCustom = (i: number, patch: Partial<AiCustomTool>) =>
    setCfg((c) => ({
      ...c,
      customTools: (c.customTools ?? []).map((t, j) => (j === i ? { ...t, ...patch } : t)),
    }));

  const addCustom = () =>
    setCfg((c) => ({
      ...c,
      customTools: [
        ...(c.customTools ?? []),
        { id: `tool-${Date.now().toString(36)}`, name: "", description: "", endpoint: "" },
      ],
    }));

  const removeCustom = (i: number) =>
    setCfg((c) => ({ ...c, customTools: (c.customTools ?? []).filter((_, j) => j !== i) }));

  // 默认模型的档位（默认强度下拉选项随它联动；不在档位内时保存会被服务端钳到首档）
  const defaultChoiceObj = cfg.choices.find((c) => c.id === cfg.defaultChoice);
  const defaultLevels = defaultChoiceObj
    ? thinkingSpec(defaultChoiceObj.provider, defaultChoiceObj.model || resolvedModels[defaultChoiceObj.provider]).levels
    : [];

  const save = () => {
    if (!cfg.choices.length) return setMessage("❌ 至少保留一个模型预设");
    if (!cfg.choices.some((c) => c.id === cfg.defaultChoice))
      return setMessage("❌ 默认模型必须是预设列表中的一项");
    const badLabel = cfg.choices.find((c) => !c.label.trim());
    if (badLabel) return setMessage("❌ 预设名称不能为空");
    setMessage("");
    startTransition(async () => {
      const r = await saveAiChat(cfg);
      if (r.error) {
        setMessage(`❌ ${r.error}`);
      } else {
        setMessage("✅ 已保存，前台立即生效（配置缓存最多延迟 30 秒）");
        setTimeout(() => setMessage(""), 2600);
      }
    });
  };

  return (
    <div className={`space-y-5 ${pending ? "opacity-60" : ""}`}>
      {/* 供应商 Key 状态 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Bot className="h-4 w-4 text-indigo-500" />
          供应商状态
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
            <div
              key={p}
              className={`rounded-xl border px-3 py-2.5 text-sm ${
                providers[p]
                  ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                  : "border-amber-200 bg-amber-50/60 text-amber-700"
              }`}
            >
              <p className="font-medium">
                {PROVIDER_LABELS[p]}
                {p === envDefault && <span className="ml-1.5 text-[0.6875rem] opacity-70">.env 默认</span>}
              </p>
              <p className="mt-0.5 text-[0.6875rem]">
                {providers[p] ? "✅ Key 已配置" : "未配置 Key（.env）"}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Key 与接入地址只在 .env 配置（DEEPSEEK_API_KEY / GLM_API_KEY / QWEN_API_KEY）；
          未配置 Key 的供应商，其下方预设会自动对访客隐藏。
        </p>
      </section>

      {/* 基础设置 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">基础设置</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className={label}>默认模型（访客未选择时使用）</p>
            <select
              className={`${input} mt-1`}
              value={cfg.defaultChoice}
              onChange={(e) => set("defaultChoice", e.target.value)}
            >
              {cfg.choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {providers[c.provider] ? "" : "（未配 Key，将自动回退）"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className={label}>默认思考强度（不在该模型档位内会自动回退首档）</p>
            <select
              className={`${input} mt-1`}
              value={defaultLevels.includes(cfg.defaultEffort as ThinkingLevel) ? cfg.defaultEffort : (defaultLevels[0] ?? "off")}
              onChange={(e) => set("defaultEffort", e.target.value)}
            >
              {defaultLevels.map((lv) => (
                <option key={lv} value={lv}>
                  {LEVEL_LABELS[lv]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1 sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.allowVisitorChoice}
                onChange={(e) => set("allowVisitorChoice", e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              允许访客在聊天页选择模型与思考强度
            </label>
          </div>
        </div>
      </section>

      {/* 模型预设 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">模型预设（最多 6 个）</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={resetDefaults}
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
              title="重置为内置的三家默认预设"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复默认预设
            </button>
            <button
              onClick={addChoice}
              disabled={cfg.choices.length >= 6}
              className="flex items-center gap-1 rounded-xl border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              添加预设
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {cfg.choices.map((c, i) => {
            const levels = thinkingSpec(c.provider, c.model || resolvedModels[c.provider]).levels;
            return (
              <div
                key={c.id}
                className={`rounded-2xl border p-4 ${
                  c.id === cfg.defaultChoice ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200 bg-slate-50/40"
                }`}
              >
                <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1.2fr_0.7fr_auto]">
                  <div>
                    <p className={label}>名称（访客可见）</p>
                    <input
                      className={`${input} mt-1`}
                      value={c.label}
                      maxLength={24}
                      onChange={(e) => updateChoice(i, { label: e.target.value })}
                      placeholder="如：DeepSeek V4 Flash"
                    />
                  </div>
                  <div>
                    <p className={label}>供应商</p>
                    <select
                      className={`${input} mt-1`}
                      value={c.provider}
                      onChange={(e) => updateChoice(i, { provider: e.target.value as AiProvider })}
                    >
                      {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
                        <option key={p} value={p}>
                          {PROVIDER_LABELS[p]}
                          {providers[p] ? "" : "（未配 Key）"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className={label}>模型名（选填，覆盖默认）</p>
                    <input
                      className={`${input} mt-1`}
                      value={c.model ?? ""}
                      maxLength={64}
                      onChange={(e) => updateChoice(i, { model: e.target.value.trim() || undefined })}
                      placeholder="留空用供应商默认（如 glm-5.3-flash）"
                    />
                  </div>
                  <div>
                    <p className={label}>基准积分（✦/条）</p>
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      className={`${input} mt-1`}
                      value={c.cost ?? ""}
                      onChange={(e) =>
                        updateChoice(i, {
                          cost: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      placeholder="按供应商默认"
                    />
                  </div>
                  <div className="flex items-end justify-end pb-1">
                    <button
                      onClick={() => removeChoice(i)}
                      disabled={cfg.choices.length <= 1}
                      title="删除该预设"
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* API 牌价换算：填官方牌价自动算基准积分（强制思考模型的输出倍数填 3） */}
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-2">
                  <span className="text-xs font-medium text-slate-400">牌价换算（元/百万tokens）</span>
                  {([
                    ["input", "输入价", "0.8"],
                    ["output", "输出价", "2.7"],
                    ["cache", "缓存价(选填)", "0.1"],
                  ] as const).map(([key, label2, ph]) => (
                    <input
                      key={key}
                      type="number"
                      min={0}
                      step={0.001}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                      value={c.apiPrice?.[key] ?? ""}
                      onChange={(e) =>
                        updateChoice(i, {
                          apiPrice: {
                            ...c.apiPrice,
                            [key]: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                      placeholder={ph}
                      title={label2}
                    />
                  ))}
                  <span className="text-xs text-slate-400">×</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    step={0.5}
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                    value={c.apiPrice?.outputMult ?? ""}
                    onChange={(e) =>
                      updateChoice(i, {
                        apiPrice: {
                          ...c.apiPrice,
                          outputMult: e.target.value === "" ? undefined : Math.max(1, Number(e.target.value) || 1),
                        },
                      })
                    }
                    placeholder="倍数"
                    title="输出膨胀倍数（强制思考模型填 3）"
                  />
                  {apiPriceSuggest(c) !== null && (
                    <>
                      <span className="text-sm font-semibold text-indigo-600">≈ ✦{apiPriceSuggest(c)}</span>
                      <button
                        onClick={() => updateChoice(i, { cost: apiPriceSuggest(c) ?? c.cost })}
                        className="rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-85"
                      >
                        填入
                      </button>
                    </>
                  )}
                </div>
                {/* 限时促销（可复用）：前台显示划线原价 + 标签，到期自动隐藏；扣费始终按基准积分 */}
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-2">
                  <span className="text-xs font-medium text-slate-400">促销</span>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                    value={c.promo?.originalCost ?? ""}
                    onChange={(e) =>
                      updateChoice(i, {
                        promo: {
                          ...c.promo,
                          originalCost:
                            e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    placeholder="原价✦"
                  />
                  <input
                    className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                    value={c.promo?.label ?? ""}
                    maxLength={12}
                    onChange={(e) => updateChoice(i, { promo: { ...c.promo, label: e.target.value || undefined } })}
                    placeholder="标签（如 限时半价）"
                  />
                  <input
                    type="date"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 outline-none focus:border-indigo-400"
                    value={c.promo?.until ?? ""}
                    onChange={(e) => updateChoice(i, { promo: { ...c.promo, until: e.target.value || undefined } })}
                  />
                  <span className="text-[11px] text-slate-400">前台显示划线原价，到期自动隐藏；留空 = 无促销</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]">
                  {c.id === cfg.defaultChoice && <span className="text-indigo-500">⭐ 当前默认</span>}
                  <span className="flex items-center gap-1 text-slate-500">
                    <BrainCog className="h-3 w-3" />
                    思考档位：{levels.map((lv) => LEVEL_LABELS[lv]).join(" / ")}
                  </span>
                  {!providers[c.provider] && (
                    <span className="text-amber-600">该供应商未配置 Key：预设保留但对访客自动隐藏</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          档位由供应商与模型名自动推断（与前台滑条一致）：qwen3.8* = 无/低/中/最高 · deepseek-v4* = 无/低/高/最高 ·
          glm-5.3* = 低/高/最高（该系列强制思考，无法关闭）。
        </p>
      </section>

      {/* 能力管理：内置工具开关 + 自定义 HTTP 工具 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Wrench className="h-4 w-4 text-indigo-500" />
          能力管理
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {BUILTIN_TOOLS.map((t) => {
            const on = cfg.tools?.[t.name] !== false;
            return (
              <label
                key={t.name}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 transition-colors ${
                  on ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200 bg-slate-50/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => toggleTool(t.name, e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-indigo-500"
                />
                <span>
                  <span className="block text-xs font-medium text-slate-700">{t.label}</span>
                  <span className="block text-[0.6875rem] text-slate-400">{t.desc}</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className={label}>自定义工具（最多 6 个，AI 可调用的 HTTP 端点）</p>
            <button
              onClick={addCustom}
              disabled={(cfg.customTools?.length ?? 0) >= 6}
              className="flex items-center gap-1 rounded-xl border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              添加工具
            </button>
          </div>
          <div className="space-y-2">
            {(cfg.customTools ?? []).map((t, i) => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-slate-50/40 p-3">
                <div className="grid gap-2 sm:grid-cols-[0.8fr_1.4fr_1.6fr_auto]">
                  <div>
                    <p className={label}>工具名（英文）</p>
                    <input
                      className={`${input} mt-1`}
                      value={t.name}
                      maxLength={48}
                      onChange={(e) => updateCustom(i, { name: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "") })}
                      placeholder="如 get_weather"
                    />
                  </div>
                  <div>
                    <p className={label}>功能描述（给 AI 看）</p>
                    <input
                      className={`${input} mt-1`}
                      value={t.description}
                      maxLength={200}
                      onChange={(e) => updateCustom(i, { description: e.target.value })}
                      placeholder="如：查询指定城市的实时天气"
                    />
                  </div>
                  <div>
                    <p className={label}>POST 端点（收到 {"{ name, input }"} JSON）</p>
                    <input
                      className={`${input} mt-1`}
                      value={t.endpoint}
                      maxLength={300}
                      onChange={(e) => updateCustom(i, { endpoint: e.target.value.trim() })}
                      placeholder="https://your-service/api/tool"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <button
                      onClick={() => removeCustom(i)}
                      title="删除该工具"
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            端点收到 POST {"{ name, input }"} JSON（10s 超时，返回 JSON 或纯文本）；仅站长可配置，
            由服务器中转调用，结果截断 4000 字。名字与内置工具重复时以内置为准。
          </p>
        </div>
      </section>

      {/* AI 积分（✦） */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">AI 积分（✦）</h2>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={cr.enabled}
              onChange={(e) => set("credits", { ...cr, enabled: e.target.checked })}
            />
            启用积分体系（关闭则回退「每天消息数」限制）
          </label>
        </div>

        {/* 每日预算换算器 */}
        <div className="mb-4 rounded-xl bg-indigo-50/60 p-3">
          <p className="text-xs font-medium text-slate-600">按每日预算换算发放积分（汇率固定：1 元 = 1000 积分）</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                step={0.1}
                value={budgetYuan}
                onChange={(e) => setBudgetYuan(e.target.value)}
                placeholder="0.5"
                className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
              <span className="text-xs text-slate-400">元/人/天</span>
            </div>
            <span className="text-xs text-slate-400">→</span>
            <span className="text-sm font-semibold text-indigo-600">
              {convertedGrant !== null ? `✦ ${convertedGrant} / 天` : "—"}
            </span>
            <button
              onClick={applyBudget}
              disabled={convertedGrant === null}
              className="rounded-lg bg-indigo-500 px-3 py-1 text-xs font-medium text-white transition-opacity disabled:opacity-40"
            >
              填入
            </button>
            {budgetApplied && (
              <button
                onClick={undoBudget}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200"
              >
                <Undo2 className="h-3 w-3" /> 还原
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            结果就近取整到 50（≥1000 时取整到 100）的倍数；「填入」只改每日重置额度，
            随时可「还原」到填入前的值。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className={label}>每日重置额度</p>
            <input
              type="number"
              min={0}
              max={99999}
              className={`${input} mt-1`}
              value={cr.dailyGrant}
              onChange={(e) => set("credits", { ...cr, dailyGrant: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <p className={label}>每日签到加成</p>
            <input
              type="number"
              min={0}
              max={99999}
              className={`${input} mt-1`}
              value={cr.checkinBonus}
              onChange={(e) => set("credits", { ...cr, checkinBonus: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <p className={label}>每等级加成/日</p>
            <input
              type="number"
              min={0}
              max={999}
              className={`${input} mt-1`}
              value={cr.levelBonusPerLevel}
              onChange={(e) => set("credits", { ...cr, levelBonusPerLevel: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <p className={label}>DeepSeek 高峰倍率</p>
            <input
              type="number"
              min={0}
              max={99}
              className={`${input} mt-1`}
              value={cr.peakMultiplier ?? ""}
              onChange={(e) =>
                set("credits", {
                  ...cr,
                  peakMultiplier:
                    e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0),
                })
              }
              placeholder="默认 2"
            />
          </div>
        </div>
        <p className={label + " mt-4"}>牌价换算参数（供各预设卡的「牌价换算」使用）</p>
        <div className="mt-1 grid gap-4 sm:grid-cols-3">
          <div>
            <p className={label}>加价倍数（成本 × 倍数 = 售价）</p>
            <input
              type="number"
              min={0}
              max={99}
              step={0.1}
              className={`${input} mt-1`}
              value={cr.pricingMarkup ?? ""}
              onChange={(e) =>
                set("credits", {
                  ...cr,
                  pricingMarkup:
                    e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0),
                })
              }
              placeholder="默认 2"
            />
          </div>
          <div>
            <p className={label}>预估输入 tokens/条</p>
            <input
              type="number"
              min={100}
              max={999999}
              className={`${input} mt-1`}
              value={cr.estInputTokens ?? ""}
              onChange={(e) =>
                set("credits", {
                  ...cr,
                  estInputTokens:
                    e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value) || 0)),
                })
              }
              placeholder="4000"
            />
          </div>
          <div>
            <p className={label}>预估输出 tokens/条（不含思考膨胀）</p>
            <input
              type="number"
              min={100}
              max={999999}
              className={`${input} mt-1`}
              value={cr.estOutputTokens ?? ""}
              onChange={(e) =>
                set("credits", {
                  ...cr,
                  estOutputTokens:
                    e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value) || 0)),
                })
              }
              placeholder="1000"
            />
          </div>
        </div>
        <p className={label + " mt-4"}>思考档位倍率（每条消息积分 = 模型基准价 × 倍率）</p>
        <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(Object.keys(LEVEL_LABELS) as ThinkingLevel[]).map((lv) => (
            <div key={lv}>
              <p className="text-center text-xs text-slate-400">{LEVEL_LABELS[lv]}</p>
              <input
                type="text"
                inputMode="decimal"
                className={`${input} mt-1 text-center`}
                value={effortDraft[lv] ?? cfg.effortCost?.[lv] ?? ""}
                onChange={(e) => updateEffort(lv, e.target.value)}
                onBlur={() => clearEffortDraft(lv)}
                placeholder={String(EFFORT_COST_DEFAULTS[lv])}
              />
              {/* 「开」只服务仅支持思考开/关的老款二档模型（glm-4.x 等），现役模型用不到 */}
              {lv === "on" && (
                <p className="mt-1 text-center text-[0.625rem] leading-tight text-slate-300">
                  仅老款开/关
                  <br />
                  二档模型使用
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          DeepSeek 高峰时段 = 北京时间工作日 9:00–12:00、14:00–18:00（与官方计费一致），倍率 ≥2
          时高峰期自动双倍以上扣积分，前台同步显示高峰提示。发放时点：每日首次到访、每日签到；
          扣减时点：每条消息按「基准价 × 档位倍率（× 高峰倍率）」原子扣减，余额不足返回引导文案，
          上游失败未产生内容时自动退款。空白输入 = 用内置默认。
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-xs font-medium text-white shadow-lg shadow-indigo-500/25 transition-opacity disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          保存 AI 对话设置
        </button>
        {message && <p className="text-xs text-slate-500">{message}</p>}
      </div>
    </div>
  );
}
