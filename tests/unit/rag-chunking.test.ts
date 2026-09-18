import { describe, expect, it } from "vitest";
import { chunkPostForEmbedding } from "@/lib/content/rag/chunking";

describe("RAG 文章切块", () => {
  it("按 Markdown 标题与自然段切块并附带来源元数据", () => {
    const chunks = chunkPostForEmbedding(
      {
        title: "测试文章",
        slug: "rag-test",
        series: "AI 学习路径",
        category: "技术",
        tags: ["RAG", "Next.js"],
        updatedAt: new Date("2026-09-17T00:00:00Z"),
      },
      "## 问题\n\n第一段。\n\n## 方案\n\n第二段。",
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("链接：/posts/rag-test");
    expect(chunks[0]).toContain("系列：AI 学习路径");
    expect(chunks[0]).toContain("章节：问题");
    expect(chunks[1]).toContain("章节：方案");
  });

  it("不会把代码围栏里的井号当作章节", () => {
    const chunks = chunkPostForEmbedding(
      { title: "代码示例", slug: "code-sample" },
      "## 正文\n\n```md\n## 不是标题\n```\n\n结尾。",
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).not.toContain("章节：不是标题");
  });
});
