import "server-only";

import type { AiChatConfig, AiCustomTool } from "@/lib/site/types";

export const CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_posts",
      description: "列出本站已发布的文章，按置顶与发布时间倒序。可按分类、标签或关键词过滤。",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "分类 slug，可选" },
          tag: { type: "string", description: "标签 slug，可选" },
          keyword: { type: "string", description: "匹配标题/摘要/正文的关键词，可选" },
          limit: { type: "number", description: "返回条数，默认 10，最大 30" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_post",
      description: "按 slug 读取一篇文章的完整内容（Markdown）。",
      parameters: {
        type: "object",
        properties: { slug: { type: "string", description: "文章 slug，可从 list_posts 结果中获得" } },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_moments",
      description: "列出站长最近的动态（说说），含内容、心情、位置与日期，按时间倒序。",
      parameters: { type: "object", properties: { limit: { type: "number", description: "默认 10，最大 30" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_albums",
      description: "列出本站全部相册：标题、简介、创建日期、照片数量与部分照片说明文字。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "site_stats",
      description: "查询已发布文章、说说、相册、分类和标签等公开站点统计。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_series",
      description: "列出公开学习系列，包含简介、文章数量、预计总阅读时间与链接。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_series",
      description: "读取一个公开学习系列的完整目录、推荐顺序、难度和预计阅读时间。",
      parameters: {
        type: "object",
        properties: { slug: { type: "string", description: "系列 slug，可从 list_series 获得" } },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "列出已发布的项目案例、技术栈、关联文章和演示入口。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project",
      description: "按 slug 读取一个已发布项目的背景、方案、复盘和关联内容。",
      parameters: {
        type: "object",
        properties: { slug: { type: "string", description: "项目 slug，可从 list_projects 获得" } },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_lab_demos",
      description: "列出实验室中可以直接体验的全部互动实验。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_content",
      description: "根据兴趣、可用时间和基础，从已发布文章、系列、项目与实验中推荐最多 3 项内容。",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "兴趣或主题关键词，可选" },
          types: {
            type: "array",
            items: { type: "string", enum: ["post", "series", "project", "lab"] },
            maxItems: 4,
          },
          maxMinutes: { type: "number", description: "可用时间（分钟），可选" },
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_music",
      description: "查询音乐馆的歌单与歌曲，可按歌单标题过滤。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "歌单标题，可选" },
          songsPerList: { type: "number", description: "每个歌单返回的歌曲数，默认 8，最大 20" },
        },
      },
    },
  },
] as const;

export const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description: "联网搜索实时信息。搜索后基于结果回答，并附上来源链接。",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "搜索关键词" } },
      required: ["query"],
    },
  },
} as const;

export function searchApiKey(): string | undefined {
  return process.env.SEARCH_API_KEY?.trim() || process.env.TAVILY_API_KEY?.trim() || undefined;
}

interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}

function buildCustomToolDefs(list?: AiCustomTool[]): ToolDef[] {
  return (list ?? [])
    .filter((tool) => tool.name && tool.endpoint)
    .map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description || tool.name,
        parameters: {
          type: "object",
          properties: { input: { type: "string", description: "调用该工具的输入内容" } },
        },
      },
    }));
}

export function getChatTools(config?: Pick<AiChatConfig, "tools" | "customTools">) {
  const enabled = (name: string) => config?.tools?.[name] !== false;
  const list: ToolDef[] = CHAT_TOOLS.filter((tool) => enabled(tool.function.name));
  if (enabled("web_search") && searchApiKey()) list.push(WEB_SEARCH_TOOL);
  list.push(...buildCustomToolDefs(config?.customTools));
  return list;
}

export const BUILTIN_TOOL_NAMES = new Set<string>(
  [...CHAT_TOOLS, WEB_SEARCH_TOOL].map((tool) => tool.function.name),
);
