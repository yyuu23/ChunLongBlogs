import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkGithubBlockquoteAlert from "remark-github-blockquote-alert";
import remarkRehype from "remark-rehype";
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

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkGithubBlockquoteAlert)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeKatex)
  .use(rehypePrettyCode, prettyCodeOptions)
  .use(rehypeSlug)
  .use(rehypeStringify, { allowDangerousHtml: true });

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
