import "server-only";

/**
 * AI 数据解读：把 admin 统计 payload 压成紧凑数字摘要喂给 LLM，
 * 生成站长视角的自然语言小结（流量趋势 / 受欢迎内容 / AI 使用 / 可执行建议）。
 */
import type { AdminStatsPayload } from "@/lib/analytics/admin-stats";
import { chatLLM } from "@/lib/ai/completions";

const INSIGHTS_PROMPT =
  "你是这个博客的数据分析师。根据站点统计数据写一份给站长本人看的中文小结。要求：\n" +
  "1. 300 字以内，3-5 个短段落或要点，直接说结论不要套话开场；\n" +
  "2. 必须覆盖：流量趋势（对比窗口前半/后半段，涨跌原因用「可能」谨慎推测）、" +
  "最受欢迎的内容（热门页面/点赞/评论 TOP）、AI 使用情况；\n" +
  "3. 结尾给 1-2 条基于数据的具体可执行建议（不要空泛的「多更新」）；\n" +
  "4. 数字用原文精确值，禁止编造数据里没有的数字；纯文本输出，可少量 emoji，不要 Markdown 表格。";

/** payload → 紧凑数字摘要（≤1500 字，traffic 取头尾+峰值+均值防超长） */
export function statsDigest(p: AdminStatsPayload): string {
  const days = p.traffic.length || 1;
  const pvSum = p.traffic.reduce((s, t) => s + t.pv, 0);
  const uvSum = p.traffic.reduce((s, t) => s + t.uv, 0);
  const peak = p.traffic.reduce((m, t) => (t.pv > m.pv ? t : m), p.traffic[0] ?? { day: "-", pv: 0, uv: 0 });
  const head = p.traffic.slice(0, 3);
  const tail = p.traffic.slice(-3);
  const line = (arr: typeof p.traffic) => arr.map((t) => `${t.day} PV${t.pv}/UV${t.uv}`).join("；");
  const parts = [
    `统计窗口：近 ${p.range} 天`,
    `概览：今日UV ${p.overview.todayUV}，昨日UV ${p.overview.yesterdayUV}，累计UV ${p.overview.uvTotal}；` +
      `AI 调用今日 ${p.overview.aiToday} / 累计 ${p.overview.aiTotal}；音乐播放累计 ${p.overview.musicTotal}；` +
      `点赞累计 ${p.overview.likeTotal}，评论累计 ${p.overview.commentTotal}`,
    `流量汇总：PV 合计 ${pvSum}（日均 ${Math.round(pvSum / days)}），UV 合计 ${uvSum}（日均 ${Math.round(uvSum / days)}），` +
      `峰值日 ${peak.day}（PV ${peak.pv}）；窗口开头三天：${line(head)}；最近三天：${line(tail)}`,
    `热门页面 TOP：${p.topPages.slice(0, 5).map((t) => `${t.key}(${t.count})`).join("、") || "无"}`,
    `点赞 TOP：${p.likeTop.slice(0, 3).map((t) => `${t.key}(${t.count})`).join("、") || "无"}；` +
      `评论 TOP：${p.commentTop.slice(0, 3).map((t) => `${t.key}(${t.count})`).join("、") || "无"}`,
    `AI 使用：${p.aiCalls.map((a) => `${a.provider}/${a.model}(${a.count})`).join("、") || "无"}；` +
      `AI 工具：${p.aiTools.slice(0, 6).map((t) => `${t.key}(${t.count})`).join("、") || "无"}`,
    `音乐 TOP：${p.musicTop.slice(0, 3).map((m) => `${m.key}(${m.count})`).join("、") || "无"}`,
    `内容资产：文章 ${p.content.postsPublished} 篇（草稿 ${p.content.postsDrafts}），总浏览 ${p.content.postViews}，` +
      `总字数 ${p.content.postWords}，说说 ${p.content.moments}，相册 ${p.content.albums}，留星 ${p.content.stars}`,
  ];
  return parts.join("\n").slice(0, 1500);
}

export async function generateInsights(
  p: AdminStatsPayload,
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const r = await chatLLM(INSIGHTS_PROMPT, statsDigest(p), { maxTokens: 500, temperature: 0.4 });
  if (!r.ok) return r;
  return { ok: true, text: r.content.trim() };
}
