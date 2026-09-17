import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { chatLLM } from "@/lib/ai";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().max(200),
  content: z.string().max(100_000),
}).strict();

const aiResultSchema = z.object({
  issues: z.array(z.object({ title: z.string().max(80), detail: z.string().max(240) }).strict()).max(8),
  prerequisites: z.array(z.string().max(120)).max(6),
  outdatedHints: z.array(z.string().max(160)).max(6),
  similarPostIds: z.array(z.number().int().positive()).max(6),
  nextTopics: z.array(z.string().max(120)).max(5),
}).strict();

const SECTION_RULES = [
  { title: "问题", pattern: /(?:^|\n)#{1,3}\s*(?:问题|背景|动机)/i },
  { title: "约束", pattern: /(?:^|\n)#{1,3}\s*(?:约束|限制|前提)/i },
  { title: "取舍", pattern: /(?:^|\n)#{1,3}\s*(?:取舍|权衡|方案选择)/i },
  { title: "结果", pattern: /(?:^|\n)#{1,3}\s*(?:结果|效果|验证)/i },
  { title: "复盘", pattern: /(?:^|\n)#{1,3}\s*(?:复盘|总结|反思)/i },
];

function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return aiResultSchema.parse(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!(await requireAdminApi())) return Response.json({ error: "未登录" }, { status: 401 });
  const quota = rateLimit(`content-health:${clientIp(request)}`, 5, 60_000);
  if (!quota.ok) {
    return Response.json({ error: `太快了，请 ${quota.retryAfter} 秒后再试` }, {
      status: 429,
      headers: { "Retry-After": String(quota.retryAfter) },
    });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.content.trim().length < 20) {
    return Response.json({ error: "正文太短或请求格式不正确" }, { status: 400 });
  }
  const { id, title, content } = parsed.data;
  const candidates = await db
    .select({ id: posts.id, title: posts.title, description: posts.description, slug: posts.slug })
    .from(posts)
    .where(id ? and(eq(posts.status, "published"), ne(posts.id, id)) : eq(posts.status, "published"));

  const internalSlugs = [...content.matchAll(/\]\(\/(?:posts)\/([a-zA-Z0-9_-]+)(?:#[^)]+)?\)/g)].map((match) => match[1]!);
  const existing = internalSlugs.length
    ? await db.select({ slug: posts.slug }).from(posts).where(eq(posts.status, "published"))
    : [];
  const existingSlugs = new Set(existing.map((post) => post.slug));
  const brokenLinks = [...new Set(internalSlugs.filter((slug) => !existingSlugs.has(slug)))];
  const missingSections = SECTION_RULES.filter((rule) => !rule.pattern.test(content)).map((rule) => rule.title);

  const ai = await chatLLM(
    "你是技术博客内容审校助手。只做建议，不改写正文。检查论证完整性、前置知识、可能过时的依赖或 API，并从候选文章中寻找应关联的内容。" +
      "只能返回 JSON：{issues:[{title,detail}],prerequisites:string[],outdatedHints:string[],similarPostIds:number[],nextTopics:string[]}。" +
      "similarPostIds 只能使用候选列表中的 id；无法确认版本已过时时只写成待核验提示，不得断言。",
    `当前文章标题：${title || "（未命名）"}\n正文：\n${content.slice(0, 8000)}\n\n候选文章：\n${JSON.stringify(candidates)}`,
    { maxTokens: 900, temperature: 0.2, timeoutMs: 60_000 },
  );
  if (!ai.ok) {
    return Response.json({ missingSections, brokenLinks, issues: [], prerequisites: [], outdatedHints: [], similarPosts: [], nextTopics: [], aiError: ai.error });
  }
  const result = parseJson(ai.content);
  if (!result) return Response.json({ error: "AI 返回的检查结果格式异常，请重试" }, { status: 502 });
  const candidatesById = new Map(candidates.map((post) => [post.id, post]));
  const similarPosts = [...new Set(result.similarPostIds)]
    .map((postId) => candidatesById.get(postId))
    .filter((post): post is NonNullable<typeof post> => !!post);
  return Response.json({
    missingSections,
    brokenLinks,
    issues: result.issues,
    prerequisites: result.prerequisites,
    outdatedHints: result.outdatedHints,
    similarPosts,
    nextTopics: result.nextTopics,
  });
}
