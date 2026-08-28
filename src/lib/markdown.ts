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

export async function renderMarkdown(markdown: string): Promise<string> {
  return String(await processor.process(markdown));
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
