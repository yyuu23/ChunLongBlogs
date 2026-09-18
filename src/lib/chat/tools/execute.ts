import "server-only";

import type { AiChatConfig } from "@/lib/site/types";
import { BUILTIN_TOOL_NAMES } from "@/lib/chat/tools/definitions";
import { getPost, getProject, getSeries, listLabDemos, listPosts, listProjects, listSeries, recommendSiteContent } from "@/lib/chat/tools/content";
import { listAlbums, listMoments, listMusic, siteStats } from "@/lib/chat/tools/community";
import { executeCustomTool, webSearch } from "@/lib/chat/tools/external";

export async function executeTool(
  name: string,
  argsJson: string,
  config?: Pick<AiChatConfig, "customTools">,
): Promise<string> {
  const custom = config?.customTools?.find((tool) => tool.name === name);
  if (!BUILTIN_TOOL_NAMES.has(name) && !custom) {
    return JSON.stringify({ error: `未知工具：${name}` });
  }

  let args: Record<string, unknown> = {};
  if (argsJson.trim()) {
    try {
      args = JSON.parse(argsJson) as Record<string, unknown>;
    } catch {
      return JSON.stringify({ error: "参数不是合法 JSON" });
    }
  }

  try {
    const handlers: Record<string, () => unknown | Promise<unknown>> = {
      list_posts: () => listPosts(args),
      get_post: () => getPost(args),
      list_moments: () => listMoments(args),
      list_albums: () => listAlbums(),
      site_stats: () => siteStats(),
      list_series: () => listSeries(),
      get_series: () => getSeries(args),
      list_projects: () => listProjects(),
      get_project: () => getProject(args),
      list_lab_demos: () => listLabDemos(),
      recommend_content: () => recommendSiteContent(args),
      list_music: () => listMusic(args),
      web_search: () => webSearch(args),
    };
    const result = custom
      ? await executeCustomTool(custom, args)
      : await handlers[name]!();
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? `查询失败：${error.message}` : "查询失败" });
  }
}
