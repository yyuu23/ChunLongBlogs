import { describe, expect, it } from "vitest";
import { renderMarkdown, extractToc, markdownCacheKey } from "@/lib/content/markdown";

describe("renderMarkdown 管线", () => {
  it("标题获得 rehype-slug 的锚点 id（中文保留）", async () => {
    const html = await renderMarkdown("# 一级\n\n## 你好世界");
    expect(html).toContain("<h2");
    expect(html).toContain('id="你好世界"');
  });

  it("GFM 表格渲染", async () => {
    const html = await renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table");
  });

  it("数学公式走 KaTeX", async () => {
    const html = await renderMarkdown("质能方程 $E=mc^2$ 成立");
    expect(html).toContain("katex");
  });

  it("代码块走 shiki 高亮", async () => {
    const html = await renderMarkdown("```ts\nconst a = 1;\n```");
    expect(html).toContain("<pre");
  });

  it("GitHub 提示框类名在清洗后保留（markdown-alert*）", async () => {
    const html = await renderMarkdown("> [!NOTE]\n> 提示内容");
    expect(html).toContain("markdown-alert");
  });

  it("GFM 任务列表渲染 checkbox", async () => {
    const html = await renderMarkdown("- [x] 已完成\n- [ ] 未完成");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("裸 HTML 白名单元素（details/summary/kbd）保留", async () => {
    const html = await renderMarkdown("<details><summary>点开</summary><kbd>Ctrl</kbd></details>");
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>");
    expect(html).toContain("<kbd>");
  });

  it("裸 HTML 危险载荷被剥：script 元素与 onerror 内联事件", async () => {
    const html = await renderMarkdown(
      '<script>alert(1)</script>\n\n<img src="https://ok.example/x.png" onerror="alert(2)">',
    );
    expect(html).not.toContain("script");
    expect(html).not.toContain("onerror");
    expect(html).toContain("https://ok.example/x.png"); // 图片本体保留
  });

  it("javascript: 协议链接被剥 href", async () => {
    const html = await renderMarkdown("[点我](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("正文图片统一补 lazy / async 解码 / no-referrer", async () => {
    const html = await renderMarkdown("![截图](https://ok.example/shot.png)");
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('referrerpolicy="no-referrer"');
  });

  it("cacheKey 命中返回同一结果；不同 key 不串", async () => {
    const a = await renderMarkdown("## A", "k1");
    const b = await renderMarkdown("## A", "k1");
    expect(a).toBe(b);
    const c = await renderMarkdown("## B", "k2");
    expect(a).not.toContain("B");
    expect(c).toContain("B");
  });

  it("markdownCacheKey 由内容决定：内容变 key 变", () => {
    expect(markdownCacheKey("post", "x")).toBe(markdownCacheKey("post", "x"));
    expect(markdownCacheKey("post", "x")).not.toBe(markdownCacheKey("post", "y"));
    expect(markdownCacheKey("rss", "x")).not.toBe(markdownCacheKey("post", "x"));
  });
});

describe("extractToc", () => {
  it("提取 h2/h3，跳过围栏代码里的假标题，清理行内代码与链接", () => {
    const md = [
      "# 不进目录的 h1",
      "## `code` 标题",
      "### [链接](http://x) 文本",
      "```",
      "## 围栏里的标题不算",
      "```",
    ].join("\n");
    const toc = extractToc(md);
    expect(toc).toHaveLength(2);
    expect(toc[0]).toMatchObject({ depth: 2, text: "code 标题" });
    expect(toc[1]).toMatchObject({ depth: 3, text: "链接 文本" });
    expect(toc.map((t) => t.text)).not.toContain("围栏里的标题不算");
  });
});
