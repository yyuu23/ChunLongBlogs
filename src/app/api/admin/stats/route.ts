import { NextResponse } from "next/server";
import { isNull, sql } from "drizzle-orm";
import { requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { albums, friendLinks, moments, photos, playlists, posts, songs, stars } from "@/lib/db/schema";
import { ZipBuilder } from "@/lib/zipStore";
import {
  aiCalls,
  interactionStats,
  localDay,
  metricSum,
  metricTop,
  totalUniqueVisitors,
  trafficSeries,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

/** admin 统计数据聚合（GET ?range=7|30|90）与导出（&format=json|csv|md|zip） */
async function buildPayload(range: number) {
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

type Payload = Awaited<ReturnType<typeof buildPayload>>;

function toCsv(p: Payload): string {
  const lines: string[] = [];
  lines.push(`# ChunLong Blog 数据统计（近 ${p.range} 天）导出于 ${p.generatedAt}`);
  lines.push("");
  lines.push("## 逐日流量");
  lines.push("day,pv,uv");
  for (const t of p.traffic) lines.push(`${t.day},${t.pv},${t.uv}`);
  lines.push("");
  lines.push("## AI 模型调用（供应商|模型|档位）");
  lines.push("provider,model,effort,count");
  for (const a of p.aiCalls) lines.push(`${a.provider},${a.model},${a.effort},${a.count}`);
  lines.push("");
  lines.push("## AI 工具调用");
  lines.push("tool,count");
  for (const t of p.aiTools) lines.push(`${t.key},${t.count}`);
  lines.push("");
  lines.push("## 音乐播放 TOP");
  lines.push("song,plays");
  for (const m of p.musicTop) lines.push(`"${m.key.replace(/"/g, '""')}",${m.count}`);
  lines.push("");
  lines.push("## 热门页面 TOP");
  lines.push("page,pv");
  for (const t of p.topPages) lines.push(`"${t.key}",${t.count}`);
  lines.push("");
  lines.push("## 点赞 TOP");
  lines.push("post,likes");
  for (const l of p.likeTop) lines.push(`"${l.key.replace(/"/g, '""')}",${l.count}`);
  lines.push("");
  lines.push("## 评论 TOP");
  lines.push("target,comments");
  for (const c of p.commentTop) lines.push(`"${c.key.replace(/"/g, '""')}",${c.count}`);
  return lines.join("\n");
}

function toMarkdown(p: Payload): string {
  const n = (x: number) => x.toLocaleString("zh-CN");
  const bar = (v: number, max: number) => "█".repeat(Math.max(1, Math.round((v / (max || 1)) * 12)));
  const md: string[] = [];
  md.push(`# 📊 ChunLong Blog 数据统计报告`);
  md.push("");
  md.push(`> 统计窗口：近 **${p.range} 天** · 生成时间：${new Date(p.generatedAt).toLocaleString("zh-CN")}`);
  md.push("");
  md.push(`## ✨ 概览`);
  md.push("");
  md.push(`| 指标 | 今日 | 昨日 | 累计 |`);
  md.push(`|---|---|---|---|`);
  md.push(`| 独立访客 UV | ${n(p.overview.todayUV)} | ${n(p.overview.yesterdayUV)} | ${n(p.overview.uvTotal)} |`);
  md.push(`| 浏览量 PV | ${n(p.overview.todayPV)} | ${n(p.overview.yesterdayPV)} | — |`);
  md.push(`| AI 调用 | ${n(p.overview.aiToday)} | — | ${n(p.overview.aiTotal)} |`);
  md.push(`| 音乐播放 | — | — | ${n(p.overview.musicTotal)} |`);
  md.push(`| 点赞 | — | — | ${n(p.overview.likeTotal)} |`);
  md.push(`| 评论 | — | — | ${n(p.overview.commentTotal)} |`);
  md.push("");
  md.push(`## 📈 逐日流量（UV / PV）`);
  md.push("");
  md.push(`| 日期 | PV | UV | 趋势 |`);
  md.push(`|---|---|---|---|`);
  const maxPv = Math.max(...p.traffic.map((t) => t.pv), 1);
  for (const t of p.traffic) {
    md.push(`| ${t.day} | ${n(t.pv)} | ${n(t.uv)} | \`${bar(t.pv, maxPv)}\` |`);
  }
  md.push("");
  md.push(`## 🤖 AI 使用（近 ${p.range} 天）`);
  md.push("");
  const maxAi = Math.max(...p.aiCalls.map((a) => a.count), 1);
  if (p.aiCalls.length) {
    md.push(`| 供应商 | 模型 | 思考档位 | 调用次数 | 占比 |`);
    md.push(`|---|---|---|---|---|`);
    const sum = p.aiCalls.reduce((s, a) => s + a.count, 0) || 1;
    for (const a of p.aiCalls) {
      md.push(
        `| ${a.provider} | ${a.model} | ${a.effort} | ${n(a.count)} | ${((a.count / sum) * 100).toFixed(1)}% \`${bar(a.count, maxAi)}\` |`,
      );
    }
  } else md.push(`_暂无数据_`);
  if (p.aiTools.length) {
    md.push("");
    md.push(`**工具调用：** ${p.aiTools.map((t) => `${t.key} ×${n(t.count)}`).join(" · ")}`);
  }
  md.push("");
  md.push(`## 🎵 音乐播放 TOP`);
  md.push("");
  if (p.musicTop.length) {
    const maxM = Math.max(...p.musicTop.map((m) => m.count), 1);
    md.push(`| 歌曲 | 播放 | 趋势 |`);
    md.push(`|---|---|---|`);
    for (const m of p.musicTop) md.push(`| ${m.key || "—"} | ${n(m.count)} | \`${bar(m.count, maxM)}\` |`);
  } else md.push(`_暂无数据_`);
  md.push("");
  md.push(`## 📚 内容资产`);
  md.push("");
  md.push(
    `文章 **${n(p.content.postsPublished)}** 篇（草稿 ${n(p.content.postsDrafts)}）· 总浏览 **${n(p.content.postViews)}** · 总字数 **${n(p.content.postWords)}** · 说说 **${n(p.content.moments)}** · 相册 **${n(p.content.albums)}** / 照片 **${n(p.content.photos)}** · 歌单 **${n(p.content.playlists)}** / 歌曲 **${n(p.content.songs)}** · 友链 **${n(p.content.friends)}** · 留星 **${n(p.content.stars)}**`,
  );
  md.push("");
  md.push(`## 🔥 热门页面`);
  md.push("");
  if (p.topPages.length) {
    md.push(`| 页面 | PV |`);
    md.push(`|---|---|`);
    for (const t of p.topPages) md.push(`| ${t.key} | ${n(t.count)} |`);
  } else md.push(`_暂无数据_`);
  md.push("");
  md.push(`---`);
  md.push(`_口径说明：UV 按匿名访客当日去重；PV 含页面浏览；AI 调用含全部供应商与思考档位。数据按天聚合存储，不含任何个人信息。_`);
  return md.join("\n");
}

export async function GET(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const range = Math.min(Math.max(Number(url.searchParams.get("range")) || 30, 1), 365);
  const format = url.searchParams.get("format");
  const payload = await buildPayload(range);

  if (!format || format === "json") {
    return NextResponse.json(payload);
  }
  const stamp = localDay().replaceAll("-", "");
  if (format === "csv") {
    return new Response("\uFEFF" + toCsv(payload), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="stats-${stamp}.csv"`,
      },
    });
  }
  if (format === "md") {
    return new Response(toMarkdown(payload), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="stats-report-${stamp}.md"`,
      },
    });
  }
  if (format === "zip") {
    const zip = new ZipBuilder()
      .add(`stats-${stamp}.json`, JSON.stringify(payload, null, 2))
      .add(`stats-${stamp}.csv`, toCsv(payload))
      .add(`stats-report-${stamp}.md`, toMarkdown(payload))
      .build();
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="stats-${stamp}.zip"`,
      },
    });
  }
  return NextResponse.json({ error: "未知格式" }, { status: 400 });
}
