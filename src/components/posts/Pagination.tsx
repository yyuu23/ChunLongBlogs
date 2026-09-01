import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";

/** 分页导航（保留当前筛选参数；语言随 cookie） */
export async function Pagination({
  page,
  perPage,
  total,
  params,
}: {
  page: number;
  perPage: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const { t } = await getT();
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") sp.set(k, v);
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/posts${qs ? `?${qs}` : ""}`;
  };

  // 页码窗口：当前页附近最多 5 个
  const window: number[] = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  for (let i = start; i <= Math.min(pages, start + 4); i++) window.push(i);

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} aria-label={t("posts.pagePrev")} className="glass-button !p-2.5">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {start > 1 && (
        <>
          <Link href={href(1)} className="glass-button !px-3.5 text-xs">1</Link>
          {start > 2 && <span className="px-1 text-muted">…</span>}
        </>
      )}
      {window.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={`glass-button !px-3.5 text-xs ${
            p === page ? "accent-page-active" : ""
          }`}
        >
          {p}
        </Link>
      ))}
      {start + 4 < pages && (
        <>
          {start + 4 < pages - 1 && <span className="px-1 text-muted">…</span>}
          <Link href={href(pages)} className="glass-button !px-3.5 text-xs">{pages}</Link>
        </>
      )}
      {page < pages && (
        <Link href={href(page + 1)} aria-label={t("posts.pageNext")} className="glass-button !p-2.5">
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}
