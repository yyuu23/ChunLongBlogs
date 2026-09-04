import { NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { stars } from "@/lib/db/schema";
import { grantBottle } from "@/lib/bottles";

export const dynamic = "force-dynamic";

/** GET /api/stars —— 留声星列表（最新 80 颗） */
export async function GET() {
  const rows = await db.select().from(stars).orderBy(desc(stars.id)).limit(80);
  return NextResponse.json({
    stars: rows.map((s) => ({
      id: s.id,
      content: s.content,
      createdAt: s.createdAt,
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
  return NextResponse.json({ star: { id: row.id, content: row.content, createdAt: row.createdAt } });
}
