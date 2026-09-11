import { aiCalls, interactionStats, metricSum, metricTop, totalUniqueVisitors, trafficSeries, localDay } from "@/lib/stats";
import { isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { albums, friendLinks, moments, photos, playlists, posts, songs, stars } from "@/lib/db/schema";
import { StatsDashboard, type StatsPayload } from "@/components/admin/StatsDashboard";

export const dynamic = "force-dynamic";

/**
 * 数据统计面板：流量趋势 / AI 使用 / 音乐 / 内容资产 / 四格式导出。
 * 首屏 30 天服务端直取，切换时间范围走 /api/admin/stats。
 */
export default async function StatsAdminPage() {
  const range = 30;
  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 86_400_000));
  const [
    traffic,
    aiCallRows,
    aiTools,
    topPages,
    musicTop,
    todayPV,
    twoDayPV,
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

  const { likeTop, commentTop, likeTotal, commentTotal } = await interactionStats(range);

  const initial: StatsPayload = {
    generatedAt: new Date().toISOString(),
    range,
    overview: {
      todayUV: traffic.find((t) => t.day === today)?.uv ?? 0,
      yesterdayUV: traffic.find((t) => t.day === yesterday)?.uv ?? 0,
      todayPV,
      yesterdayPV: Math.max(0, twoDayPV - todayPV),
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
  return (
    <div className="mx-auto mb-6 max-w-5xl">
      <h1 className="mb-6 text-xl font-bold">数据统计</h1>
      <StatsDashboard initial={initial} />
    </div>
  );
}
