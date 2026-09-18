import "server-only";

/**
 * admin 统计数据聚合：/api/admin/stats 路由与 /admin/stats 页面共用
 * （此前两份复制，AI 数据解读一并改走这份）。payload 结构保持不变，
 * 四格式导出（json/csv/md/zip）与前端面板都消费它。
 */
import { isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { albums, friendLinks, moments, photos, playlists, posts, songs, stars } from "@/lib/db/schema";
import {
  aiCalls,
  interactionStats,
  localDay,
  metricSum,
  metricTop,
  totalUniqueVisitors,
  trafficSeries,
} from "@/lib/analytics/stats";

/** admin 统计数据聚合（range = 1~365 天） */
export async function buildAdminStatsPayload(range: number) {
  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 86_400_000));
  const [
    traffic,
    aiCallRows,
    aiTools,
    topPages,
    musicTop,
    todayPV,
    yesterdayPV,
    aiToday,
    aiTotal,
    musicTotal,
    imgTotal,
    uvTotal,
    [postStats],
    [momentCount],
    [albumCount],
    [photoCount],
    [playlistCount],
    [songCount],
    [friendCount],
    [starCount],
  ] = await Promise.all([
    trafficSeries(range),
    aiCalls(range),
    metricTop("ai_tool", range, 15),
    metricTop("pv", range, 12),
    metricTop("music_play", range, 12),
    metricSum("pv", 1),
    metricSum("pv", 2),
    metricSum("ai_call", 1),
    metricSum("ai_call", "all"),
    metricSum("music_play", "all"),
    metricSum("ai_image", "all"),
    totalUniqueVisitors(),
    db
      .select({
        published: sql<number>`count(*) FILTER (WHERE status = 'published')`,
        drafts: sql<number>`count(*) FILTER (WHERE status = 'draft')`,
        views: sql<number>`coalesce(sum(views), 0)`,
        words: sql<number>`coalesce(sum(word_count), 0)`,
      })
      .from(posts),
    db.select({ n: sql<number>`count(*)` }).from(moments),
    db.select({ n: sql<number>`count(*)` }).from(albums),
    db.select({ n: sql<number>`count(*)` }).from(photos),
    db.select({ n: sql<number>`count(*)` }).from(playlists),
    db.select({ n: sql<number>`count(*)` }).from(songs),
    db.select({ n: sql<number>`count(*)` }).from(friendLinks),
    // 留声星按未删除口径统计（软删的不算内容资产）
    db.select({ n: sql<number>`count(*)` }).from(stars).where(isNull(stars.deletedAt)),
  ]);
  const todayUV = traffic.find((t) => t.day === today)?.uv ?? 0;
  const yesterdayUV = traffic.find((t) => t.day === yesterday)?.uv ?? 0;
  // metricSum(pv, 2) 含今昨两日，昨日 = 2 日和 − 今日
  const pvYesterday = Math.max(0, yesterdayPV - todayPV);

  // 互动指标：like（key=slug）/ comment（key=refType:refId）TOP 榜 + 累计
  const { likeTop, commentTop, likeTotal, commentTotal } = await interactionStats(range);

  return {
    generatedAt: new Date().toISOString(),
    range,
    overview: {
      todayUV,
      yesterdayUV,
      todayPV,
      yesterdayPV: pvYesterday,
      uvTotal,
      aiToday,
      aiTotal,
      musicTotal,
      imgTotal,
      likeTotal,
      commentTotal,
    },
    traffic,
    aiCalls: aiCallRows,
    aiTools,
    topPages: topPages.filter((p) => p.key && p.key !== "/"),
    musicTop,
    likeTop,
    commentTop,
    content: {
      postsPublished: Number(postStats?.published) || 0,
      postsDrafts: Number(postStats?.drafts) || 0,
      postViews: Number(postStats?.views) || 0,
      postWords: Number(postStats?.words) || 0,
      moments: Number(momentCount?.n) || 0,
      albums: Number(albumCount?.n) || 0,
      photos: Number(photoCount?.n) || 0,
      playlists: Number(playlistCount?.n) || 0,
      songs: Number(songCount?.n) || 0,
      friends: Number(friendCount?.n) || 0,
      stars: Number(starCount?.n) || 0,
    },
  };
}

export type AdminStatsPayload = Awaited<ReturnType<typeof buildAdminStatsPayload>>;
