"use client";

import { useState, useTransition } from "react";
import { Bot, BrainCog, Loader2, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { saveAiChat } from "@/app/admin/actions";
import type { AiChatChoice, AiChatConfig, AiProvider } from "@/lib/site";
import { thinkingSpec, type ThinkingLevel } from "@/lib/llm-thinking";

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

/**
 * AI 对话管理表单：模型预设 / 默认模型与思考强度 / 访客选择开关 / 每访客限额。
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
                <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1.2fr_auto]">
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

      {/* 每访客限额 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">每访客限额</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className={label}>每小时消息数（滑动窗口，0 = 不限）</p>
            <input
              type="number"
              min={0}
              max={999}
              className={`${input} mt-1`}
              value={cfg.perVisitorHourly}
              onChange={(e) => set("perVisitorHourly", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <p className={label}>每天消息数（0 = 不限）</p>
            <input
              type="number"
              min={0}
              max={999}
              className={`${input} mt-1`}
              value={cfg.perVisitorDaily}
              onChange={(e) => set("perVisitorDaily", Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          按访客身份（浏览器本地 ID）计数，重启服务清零；同 IP 每分钟限流与全站每日总额度仍在 .env
          （CHAT_RATE_LIMIT / CHAT_DAILY_LIMIT）作为外层硬护栏。访客切换浏览器身份可绕过此层，
          因此这里定位是"礼貌限额"，不是防刷。
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
