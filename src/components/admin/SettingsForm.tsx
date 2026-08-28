"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, CheckCircle2, Plus, X, Megaphone, Sparkles } from "lucide-react";
import { saveSettings, rebuildEmbeddingsAction } from "@/app/admin/actions";
import { UploadButton } from "@/components/admin/UploadButton";
import type { SiteConfig } from "@/lib/site";

const label = "flex flex-col gap-1.5";
const input =
  "rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400";

export function SettingsForm({ initial }: { initial: SiteConfig }) {
  const [config, setConfig] = useState<SiteConfig>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [embedMsg, setEmbedMsg] = useState("");
  const [embedBusy, setEmbedBusy] = useState(false);

  const rebuildEmbeddings = async () => {
    setEmbedBusy(true);
    setEmbedMsg("");
    const r = await rebuildEmbeddingsAction();
    setEmbedBusy(false);
    if ("error" in r && r.error) setEmbedMsg(`❌ ${r.error}`);
    else if ("message" in r && r.message) setEmbedMsg(`✅ ${r.message}`);
  };

  const set = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const submit = () => {
    startTransition(async () => {
      await saveSettings(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const socialItems = config.socials;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-8">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-slate-100/90 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8 lg:pt-0">
        <h1 className="text-xl font-bold">站点设置</h1>
        <button
          onClick={submit}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? "已保存 ✓" : "保存设置"}
        </button>
      </header>

      {/* 基本信息 */}
      <section className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">基本信息</h2>
        <label className={label}>
          <span className="text-xs font-medium text-slate-500">站名</span>
          <input value={config.siteName} onChange={(e) => set("siteName", e.target.value)} className={input} />
        </label>
        <label className={label}>
          <span className="text-xs font-medium text-slate-500">作者名</span>
          <input value={config.authorName} onChange={(e) => set("authorName", e.target.value)} className={input} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          <span className="text-xs font-medium text-slate-500">站点描述（SEO）</span>
          <input value={config.siteDescription} onChange={(e) => set("siteDescription", e.target.value)} className={input} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          <span className="text-xs font-medium text-slate-500">个人简介</span>
          <textarea value={config.bio} onChange={(e) => set("bio", e.target.value)} rows={2} className={`resize-none ${input}`} />
        </label>
        <div className={`${label} sm:col-span-2`}>
          <span className="text-xs font-medium text-slate-500">头像</span>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={config.avatar} alt="头像预览" className="h-14 w-14 rounded-full ring-2 ring-slate-200" />
            <input value={config.avatar} onChange={(e) => set("avatar", e.target.value)} className={`flex-1 ${input}`} />
            <UploadButton onUploaded={([url]) => set("avatar", url)} label="上传" />
          </div>
        </div>
      </section>

      {/* 社交链接 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">社交链接</h2>
          <button
            onClick={() => set("socials", [...socialItems, { platform: "link", url: "" }])}
            className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <Plus className="h-3.5 w-3.5" /> 添加
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {socialItems.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                value={s.platform}
                onChange={(e) => {
                  const next = [...socialItems];
                  next[i] = { ...s, platform: e.target.value };
                  set("socials", next);
                }}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-indigo-400"
              >
                {["github", "bilibili", "gitee", "email", "rss", "link"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                value={s.url}
                onChange={(e) => {
                  const next = [...socialItems];
                  next[i] = { ...s, url: e.target.value };
                  set("socials", next);
                }}
                placeholder="https://..."
                className={`min-w-40 flex-1 ${input}`}
              />
              <button
                onClick={() => set("socials", socialItems.filter((_, j) => j !== i))}
                className="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 公告 */}
      <section className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
          <Megaphone className="h-4 w-4 text-indigo-400" />
          公告栏（节气日期自动显示）
        </h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.announcement.enabled}
            onChange={(e) => set("announcement", { ...config.announcement, enabled: e.target.checked })}
            className="h-4 w-4 accent-indigo-500"
          />
          <span className="text-sm text-slate-600">显示公告栏</span>
        </label>
        <label className={label}>
          <span className="text-xs font-medium text-slate-500">自定义公告（可选）</span>
          <input
            value={config.announcement.customText ?? ""}
            onChange={(e) => set("announcement", { ...config.announcement, customText: e.target.value })}
            className={input}
          />
        </label>
      </section>

      {/* 背景设置 */}
      <section className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">背景与横幅</h2>
        <label className={label}>
          <span className="text-xs font-medium text-slate-500">背景模式</span>
          <select
            value={config.bgMode}
            onChange={(e) => set("bgMode", e.target.value as "image" | "gradient")}
            className={`${input} bg-white`}
          >
            <option value="image">背景图轮播（毛玻璃遮罩）</option>
            <option value="gradient">纯流动渐变</option>
          </select>
        </label>
        <label className={label}>
          <span className="text-xs font-medium text-slate-500">渐变调色板（逗号分隔 4 个色值）</span>
          <input
            value={config.gradientPalette.join(", ")}
            onChange={(e) =>
              set(
                "gradientPalette",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              )
            }
            className={`font-mono text-xs ${input}`}
          />
        </label>
        <label className={`${label} sm:col-span-2`}>
          <span className="text-xs font-medium text-slate-500">背景图列表（每行一个 URL）</span>
          <textarea
            value={config.bgImages.join("\n")}
            onChange={(e) => set("bgImages", e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))}
            rows={4}
            className={`resize-none font-mono text-xs ${input}`}
          />
        </label>
        <label className={`${label} sm:col-span-2`}>
          <span className="text-xs font-medium text-slate-500">
            首页 Banner（每行：图片URL | 标题 | 副标题）
          </span>
          <textarea
            value={config.banners.map((b) => `${b.image} | ${b.title} | ${b.subtitle}`).join("\n")}
            onChange={(e) =>
              set(
                "banners",
                e.target.value
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => {
                    const [image = "", title = "", subtitle = ""] = line.split("|").map((s) => s.trim());
                    return { image, title, subtitle };
                  }),
              )
            }
            rows={4}
            className={`resize-none font-mono text-xs ${input}`}
          />
        </label>
      </section>

      {/* giscus 评论 */}
      <section className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">
          giscus 评论（在 giscus.app 获取配置，留空关闭评论）
        </h2>
        {(
          [
            ["repo", "仓库（owner/repo）"],
            ["repoId", "repoId"],
            ["category", "分类名"],
            ["categoryId", "categoryId"],
          ] as const
        ).map(([key, title]) => (
          <label key={key} className={label}>
            <span className="text-xs font-medium text-slate-500">{title}</span>
            <input
              value={config.giscus?.[key] ?? ""}
              onChange={(e) =>
                set("giscus", { repo: "", repoId: "", category: "", categoryId: "", ...(config.giscus ?? {}), [key]: e.target.value })
              }
              className={input}
            />
          </label>
        ))}
      </section>

      {/* 页脚与关于 */}
      <section className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">页脚 / 备案 / 关于页</h2>
        <label className={label}>
          <span className="text-xs font-medium text-slate-500">ICP 备案号（可空）</span>
          <input value={config.icp} onChange={(e) => set("icp", e.target.value)} className={input} />
        </label>
        <label className={label}>
          <span className="text-xs font-medium text-slate-500">页脚附加文字（可空）</span>
          <input value={config.footerText} onChange={(e) => set("footerText", e.target.value)} className={input} />
        </label>
        <label className={label}>
          <span className="text-xs font-medium text-slate-500">CC 协议（如 BY-NC-SA 4.0，留空隐藏）</span>
          <input value={config.ccLicense} onChange={(e) => set("ccLicense", e.target.value)} className={input} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          <span className="text-xs font-medium text-slate-500">AI 小助手人设（system prompt，需在 .env 配置接口后才生效）</span>
          <textarea value={config.aiPersona} onChange={(e) => set("aiPersona", e.target.value)} rows={2} className={`resize-none ${input}`} />
        </label>
        <div className={`${label} sm:col-span-2`}>
          <span className="text-xs font-medium text-slate-500">AI 博客问答（RAG）向量索引</span>
          <div className="flex items-center gap-2">
            <button
              onClick={rebuildEmbeddings}
              disabled={embedBusy}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-500 disabled:opacity-60"
            >
              {embedBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {embedBusy ? "重建中…" : "重建全部文章向量"}
            </button>
            {embedMsg && <span className="text-xs text-slate-500">{embedMsg}</span>}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            配置 .env 的 EMBEDDING_API_KEY 后可启用语义检索（推荐智谱 embedding-3）；未配置时自动使用关键词检索，问答功能同样可用
          </p>
        </div>
        <label className={`${label} sm:col-span-2`}>
          <span className="text-xs font-medium text-slate-500">关于页内容（Markdown）</span>
          <textarea
            value={config.aboutMarkdown}
            onChange={(e) => set("aboutMarkdown", e.target.value)}
            rows={10}
            className={`resize-y font-mono text-xs ${input}`}
          />
        </label>
      </section>

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "已保存" : "保存全部设置"}
        </button>
      </div>
    </div>
  );
}
