"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { trackEvent } from "@/lib/track";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import type { GiscusConfig } from "@/lib/site";

/** giscus 支持的界面语言与站点语言的映射 */
const GISCUS_LANG: Record<string, string> = {
  zh: "zh-CN",
  en: "en",
  ja: "ja",
  ko: "ko",
};

/** 阅读量上报 + 展示（同一会话对同一文章只计一次） */
export function ViewCounter({ slug, initial, postId }: { slug: string; initial: number; postId?: number }) {
  const t = useT();
  const [views, setViews] = useState(initial);
  const posted = useRef(false);

  useEffect(() => {
    if (posted.current) return;
    posted.current = true;
    const key = `cl-viewed-${slug}`;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {}
    trackEvent("read_post", { postId });
    fetch(`/api/posts/${slug}/view`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.views === "number") setViews(d.views);
      })
      .catch(() => {});
  }, [slug]);

  return (
    <span className="inline-flex items-center gap-1">
      <Eye className="h-3.5 w-3.5" />
      {t("posts.views", { n: views })}
    </span>
  );
}

/** giscus 评论区（未配置时显示占位提示，仅作者可见后台配置入口说明） */
export function GiscusComments({ config }: { config: GiscusConfig | null }) {
  const t = useT();
  const { locale } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !config || !ref.current || ref.current.childElementCount > 0) return;
    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", config.repo);
    script.setAttribute("data-repo-id", config.repoId);
    script.setAttribute("data-category", config.category);
    script.setAttribute("data-category-id", config.categoryId);
    script.setAttribute("data-mapping", "pathname");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", "transparent_dark");
    script.setAttribute("data-lang", GISCUS_LANG[locale] ?? "zh-CN");
    ref.current.appendChild(script);
  }, [mounted, config, locale]);

  if (!config) {
    return (
      <p className="glass-card p-6 text-center text-sm text-muted">
        {t("posts.commentsEmpty")}
      </p>
    );
  }

  return (
    <div className="glass-card p-5">
      <div ref={ref} />
    </div>
  );
}
