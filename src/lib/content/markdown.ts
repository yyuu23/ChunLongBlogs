import { unified } from "unified";
import type { Plugin } from "unified";
import type { Root } from "hast";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkGithubBlockquoteAlert from "remark-github-blockquote-alert";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";

const prettyCodeOptions: PrettyCodeOptions = {
  // 多主题输出 CSS 变量（--shiki-light/-dark + 各 accent 组），前端按 data-accent 切换
  theme: {
    light: "github-light",
    dark: "github-dark-dimmed",
    "rose-light": "rose-pine-dawn",
    "rose-dark": "rose-pine-moon",
    "emerald-light": "vitesse-light",
    "emerald-dark": "vitesse-dark",
    "amber-light": "one-light",
    "amber-dark": "one-dark-pro",
    "cyan-light": "min-light",
    "cyan-dark": "min-dark",
  },
  keepBackground: false,
};

/**
 * 白名单清洗 schema：只洗「作者输入」的裸 HTML（现网文章零裸 HTML，
 * 属预防性加固——防未来开放投稿/AI 直写入库时引入存储型 XSS）。
 * 顺序约束：sanitize 必须在 rehypeKatex / rehypePrettyCode / rehypeSlug
 * **之前**——这些可信插件输出的 KaTeX 类名、Shiki 内联 style、标题 id
 * 不进白名单也能原样保留；若放它们后面，schema 得跟着插件版本走，脆。
 * - className 对所有元素放行：GitHub 提示框（markdown-alert*）与数学
 *   节点（math-inline/math-display）的定位类都在作者输入侧；
 * - 不放行 script / iframe / style：将来真要嵌 B 站视频再显式加；
 * - 默认 schema 已含 a/img 的 http(s) 协议限制（javascript: 会被剥）。
 */
const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // 保险显式声明（默认 schema 大多已含，重复项无害）：GFM 任务列表与常用排版元素
    "details",
    "summary",
    "kbd",
    "mark",
    "sub",
    "sup",
    // GitHub 提示框标题前的 octicon（remark-github-blockquote-alert 在
    // remark→rehype 转换时注入，位于 sanitize 之前，需进白名单才不被剥）
    "svg",
    "path",
  ],
  attributes: {
    ...defaultSchema.attributes,
    // 类名放行到全部元素（见上：alert/math 定位类）
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className"],
    // octicon 用到的 svg/path 属性。viewBox 是 SVG 特有大小写原样匹配；
    // aria-hidden 在 hast 里以驼峰 property 名（ariaHidden）查白名单，输出仍是连字符形式
    svg: [...(defaultSchema.attributes?.svg ?? []), "viewBox", "width", "height", "ariaHidden", "fill"],
    path: [...(defaultSchema.attributes?.path ?? []), "d"],
    // GFM 任务列表的 checkbox（remark-rehype 生成 input[checked][disabled]）
    input: [...(defaultSchema.attributes?.input ?? []), ["checked", "checked"], ["disabled", "disabled"], ["type", "checkbox"]],
    // GFM 表格对齐（remark-rehype 输出 align 属性）
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
  },
};

/**
 * 本地插件（3a）：正文 <img> 统一补加载属性——loading=lazy + 异步解码 +
 * 不带 referrer。正文首屏无图，全量 lazy 安全；不做尺寸探测（远程图在
 * 2 核 SSR 上探测代价高、失败模式差），CLS 交给 .md img 的 max-width
 * 约束与浏览器渐进渲染。手写 ~12 行递归，不引 unist-util-visit。
 */
const rehypeLazyImages: Plugin<[], Root> = () => (tree) => {
  const walk = (node: Root["children"][number]) => {
    if (node.type === "element" && node.tagName === "img") {
      const props = (node.properties ??= {}) as Record<string, unknown>;
      props.loading = "lazy";
      props.decoding = "async";
      props.referrerPolicy = "no-referrer";
    }
    if ("children" in node) {
      for (const child of node.children as Root["children"]) walk(child);
    }
  };
  for (const child of tree.children) walk(child);
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkGithubBlockquoteAlert)
  .use(remarkRehype, { allowDangerousHtml: true }) // 裸 HTML 先进树为 raw 节点（交给下面两步处理）
  .use(rehypeRaw) // raw 解析成真实元素，sanitize 才洗得到它（只插 sanitize 无效）
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeKatex)
  .use(rehypePrettyCode, prettyCodeOptions)
  .use(rehypeSlug)
  .use(rehypeLazyImages)
  .use(rehypeStringify); // 清洗后树里无 raw/危险节点，不再需要 allowDangerousHtml

/** 渲染结果 LRU 缓存：shiki 十主题管线是文章页 SSR 的 CPU 大头（单篇
 * 数十毫秒），同一内容重复渲染直接返回缓存。cacheKey 由调用方提供并
 * 含数据更新时间（如 `post:${id}:${updatedAt}`），数据变更天然失效。
 * 32 篇 × 平均 ~150KB HTML ≈ 5MB 内存，2GB 机器无压力 */
const HTML_CACHE_MAX = 32;
const htmlCache = new Map<string, string>();

export async function renderMarkdown(
  markdown: string,
  cacheKey?: string,
): Promise<string> {
  if (cacheKey) {
    const hit = htmlCache.get(cacheKey);
    if (hit !== undefined) {
      // 命中即提升为最新（Map 迭代顺序 = 插入顺序，最旧在前）
      htmlCache.delete(cacheKey);
      htmlCache.set(cacheKey, hit);
      return hit;
    }
  }
  const html = String(await processor.process(markdown));
  if (cacheKey) {
    htmlCache.set(cacheKey, html);
    if (htmlCache.size > HTML_CACHE_MAX) {
      htmlCache.delete(htmlCache.keys().next().value as string);
    }
  }
  return html;
}

/** 由内容派生缓存 key（长度 + FNV-1a 32 位）：内容变 key 变。
 * 供没有显式版本号可用的调用方（文章页/关于页）以渲染内容本身定 key */
export function markdownCacheKey(scope: string, markdown: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < markdown.length; i++) {
    h ^= markdown.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${scope}:${markdown.length}:${(h >>> 0).toString(36)}`;
}

export interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3;
}

/** 从 Markdown 源码提取 h2/h3 目录，slug 与 rehype-slug 保持一致 */
export function extractToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (m) {
      const text = m[2]
        .replace(/`([^`]*)`/g, "$1")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
      items.push({
        id: slugger.slug(text),
        text,
        depth: m[1].length as 2 | 3,
      });
    }
  }
  return items;
}
