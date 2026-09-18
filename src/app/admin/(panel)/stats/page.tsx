import { llmConfigured } from "@/lib/ai/completions";
import { buildAdminStatsPayload } from "@/lib/analytics/admin-stats";
import { StatsDashboard, type StatsPayload } from "@/components/admin/StatsDashboard";

export const dynamic = "force-dynamic";

/**
 * 数据统计面板：流量趋势 / AI 使用 / 音乐 / 内容资产 / 四格式导出。
 * 首屏 30 天服务端直取（lib/adminStats 与 /api/admin/stats 共用），
 * 切换时间范围走 API；配置了 LLM key 时额外显示「AI 解读」。
 */
export default async function StatsAdminPage() {
  const initial = (await buildAdminStatsPayload(30)) as StatsPayload;
  const aiEnabled = await llmConfigured();
  return (
    <div className="mx-auto mb-6 max-w-5xl">
      <h1 className="mb-6 text-xl font-bold">数据统计</h1>
      <StatsDashboard initial={initial} aiEnabled={aiEnabled} />
    </div>
  );
}
