import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { stars } from "@/lib/db/schema";
import { StarsManager, type AdminStarItem } from "@/components/admin/StarsManager";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 留声星管理：访客在实验室小行星带留下的公开 UGC（含已软删的，便于恢复） */
export default async function AdminStarsPage() {
  const rows = await db.select().from(stars).orderBy(desc(stars.id)).limit(300);
  const items: AdminStarItem[] = rows.map((s) => ({
    id: s.id,
    content: s.content,
    date: formatDate(s.createdAt),
    visitor: s.visitorId ? `…${s.visitorId.slice(-6)}` : "匿名",
    featured: !!s.featured,
    deleted: s.deletedAt != null,
  }));

  return (
    <div>
      <h1 className="mx-auto mb-2 max-w-3xl text-xl font-bold">留声星管理</h1>
      <p className="mx-auto mb-6 max-w-3xl text-xs text-slate-500">
        访客在实验室小行星带留下的公开内容。精选 = 前台渲染为白金亮星；删除为软删除（前台与公开
        API 不可见，可随时恢复）。最多显示最近 300 条。
      </p>
      <StarsManager items={items} />
    </div>
  );
}
