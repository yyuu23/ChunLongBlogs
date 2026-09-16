/**
 * 定时发布（惰性触发，无 cron）：status='scheduled' 且 publishedAt 已到点的文章
 * 转为 published（保留原 publishedAt 目标时间，RSS/归档按预定时刻显示）。
 * 挂在 /api/stats 打点路由（真实流量才触发，60 秒节流防每请求查库）；
 * 零流量时发布会延迟到下一位访客到访——编辑器面板有文案明示。
 */
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";

let lastCheck = 0;
const THROTTLE_MS = 60_000;

export async function checkScheduledPosts(): Promise<void> {
  const now = Date.now();
  if (now - lastCheck < THROTTLE_MS) return;
  lastCheck = now;
  try {
    const due = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.status, "scheduled"), lte(posts.publishedAt, new Date(now))))
      .limit(20);
    for (const row of due) {
      // 逐条更新：publishedAt 保留原值（预定时刻），不刷成实际转态时刻
      await db.update(posts).set({ status: "published" }).where(eq(posts.id, row.id));
      try {
        const { rebuildPostEmbeddings } = await import("@/lib/rag");
        void rebuildPostEmbeddings(row.id).catch(() => {});
      } catch {}
    }
    if (due.length) {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/", "layout");
    }
  } catch {
    // 定时检查失败不影响打点主流程
  }
}
