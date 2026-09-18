import type { AiChatConfig } from "@/lib/site/types";

export const TOOL_LABELS: Record<string, string> = {
  list_posts: "查询文章列表",
  get_post: "读取文章内容",
  list_moments: "查询最近说说",
  list_albums: "查询相册",
  site_stats: "查询站点统计",
  list_series: "查询学习系列",
  get_series: "读取系列目录",
  list_projects: "查询项目作品",
  get_project: "读取项目详情",
  list_lab_demos: "查询互动实验",
  recommend_content: "生成站内推荐",
  list_music: "查询音乐馆",
  web_search: "联网搜索",
};

export function toolLabelOf(name: string, config?: Pick<AiChatConfig, "customTools">): string {
  if (config?.customTools?.some((tool) => tool.name === name)) return name;
  return TOOL_LABELS[name] ?? name;
}

export function toolCallSummary(name: string, argsJson: string): string {
  try {
    const args = argsJson.trim() ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
    const parts = Object.entries(args)
      .slice(0, 3)
      .map(([key, value]) => `${key}=${typeof value === "string" ? `"${value.slice(0, 40)}"` : String(value)}`);
    return parts.length ? `${name}(${parts.join(", ")})` : `${name}()`;
  } catch {
    return name;
  }
}
