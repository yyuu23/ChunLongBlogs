import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { stars } from "@/lib/db/schema";
import { grantBottle } from "@/lib/bottles";

export const dynamic = "force-dynamic";

/**
 * GET /api/stars —— 留声星列表（最新 80 颗 ∪ 该访客自己的星）。
 * ?visitorId= 时自己的星带 mine 标记——即使被 80 颗窗口顶出去也照常返回，
 * 否则访客会"找不到自己留的星"（位置由 id 哈希、形态与普通星无异，
 * 归属信息只能靠接口给出）。软删除的一律不可见。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const visitorId = (searchParams.get("visitorId") ?? "").trim().slice(0, 64);

  const rows = await db
    .select()
    .from(stars)
    .where(isNull(stars.deletedAt))
    .orderBy(desc(stars.id))
    .limit(80);

  // 自己的星（最新 10 颗）：窗口外的补进列表，窗口内的由 rows 覆盖
  const own =
    visitorId
      ? await db
          .select()
          .from(stars)
          .where(and(eq(stars.visitorId, visitorId), isNull(stars.deletedAt)))
          .orderBy(desc(stars.id))
          .limit(10)
      : [];
  const inWindow = new Set(rows.map((s) => s.id));
  const merged = [...rows, ...own.filter((s) => !inWindow.has(s.id))];

  return NextResponse.json({
    stars: merged.map((s) => ({
      id: s.id,
      content: s.content,
      createdAt: s.createdAt,
      ...(visitorId && s.visitorId === visitorId ? { mine: true } : {}),
      ...(s.featured ? { featured: true } : {}),
    })),
  });
}

/** POST /api/stars —— 留下一颗星（50 字限制 + 每访客 24h 最多 3 条）+ 封存一只漂流瓶 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    content?: string;
    visitorId?: string;
    theme?: unknown;
  } | null;

  const content = (body?.content ?? "").trim().slice(0, 50);
  const visitorId = (body?.visitorId ?? "").trim().slice(0, 64);

  if (!content || content.length < 2) {
    return NextResponse.json({ error: "写下 2-50 个字再化作星星吧 ✨" }, { status: 400 });
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(stars)
    .where(and(eq(stars.visitorId, visitorId || "anonymous"), gte(stars.createdAt, since)));

  if (Number(countRow?.n ?? 0) >= 3) {
    return NextResponse.json({ error: "一天最多留 3 颗星哦，明天再来 ✨" }, { status: 429 });
  }

  const [row] = await db.insert(stars).values({ content, visitorId }).returning();
  // 留星封瓶：瓶里永远留着今天留下的这句话
  await grantBottle(visitorId, "star", row.id, body?.theme, content).catch(() => {});
  return NextResponse.json({ star: { id: row.id, content: row.content, createdAt: row.createdAt, mine: true } });
}
