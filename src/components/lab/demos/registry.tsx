"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/track";
import { useT } from "@/components/providers/LocaleProvider";

/**
 * 实验台组件映射（客户端）：slug → 懒加载组件。
 * 新增实验 = 写组件 + 在这里加一行 + lib/lab-demos.ts 加元信息。
 */
const DEMO_COMPONENTS: Record<string, React.ComponentType> = {
  fireworks: dynamic(() => import("./Fireworks"), {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    ),
  }),
};

/** demo 页外壳：返回链接 + 标题简介 + 画布区 + 进页埋点（计 XP/成就） */
export function DemoShell({
  slug,
  emoji,
  title,
  desc,
}: {
  slug: string;
  emoji: string;
  title: string;
  desc: string;
}) {
  const t = useT();
  const Demo = DEMO_COMPONENTS[slug];

  useEffect(() => {
    trackEvent("visit_lab_demo", { demoId: slug });
  }, [slug]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <Link
          href="/lab"
          className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("lab.backToLab")}
        </Link>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-serif text-xl font-black">
            <span>{emoji}</span>
            {title}
          </h1>
          <p className="truncate text-xs text-muted">{desc}</p>
        </div>
      </header>
      <div className="relative h-[min(78vh,46rem)] w-full">{Demo ? <Demo /> : null}</div>
    </div>
  );
}
