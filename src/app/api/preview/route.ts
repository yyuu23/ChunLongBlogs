import { NextResponse } from "next/server";
import { renderMarkdown } from "@/lib/content/markdown";
import { requireAdminApi } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

/** Markdown 实时预览：POST { markdown } → html（与前台同一渲染管线） */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { markdown?: string } | null;
  const html = await renderMarkdown(body?.markdown ?? "");
  return NextResponse.json({ html });
}
