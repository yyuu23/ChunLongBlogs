"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { trackEvent } from "@/lib/track";
import { useT } from "@/components/providers/LocaleProvider";

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
