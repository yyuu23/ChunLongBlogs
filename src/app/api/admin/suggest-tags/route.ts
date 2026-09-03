import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tags as tagsTable } from "@/lib/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { suggestTags } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * AI 生成文章标签建议（后台专用）：编辑器"AI 生成标签"按钮调用。
 * 现有标签列表由服务端自查 tags 表（不信任客户端），供模型优先复用，
 * 保持标签库统一——这正是与"分类与标签"管理页的联动。
 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rl = rateLimit(`suggest-tags:${clientIp(request)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `太快了，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    content?: unknown;
  } | null;
  if (typeof body?.title !== "string" || typeof body?.content !== "string") {
    return NextResponse.json(
      { error: "请求格式错误：title 与 content 应为字符串" },
      { status: 400 },
    );
  }

  const existing = await db
    .select({ name: tagsTable.name })
    .from(tagsTable)
    .orderBy(asc(tagsTable.name));

  const r = await suggestTags(body.title.trim(), body.content, existing.map((t) => t.name));
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ tags: r.tags });
}
