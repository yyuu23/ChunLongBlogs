import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** 日历数据：GET /api/calendar?year=2026&month=8 → { days: { "2026-08-28": 2 } } */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;

  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return NextResponse.json({ error: "invalid month" }, { status: 400 });
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  try {
    const rows = await db
      .select({ publishedAt: posts.publishedAt, createdAt: posts.createdAt })
      .from(posts)
      .where(eq(posts.status, "published"));

    const days: Record<string, number> = {};
    for (const row of rows) {
      const d = new Date(row.publishedAt ?? row.createdAt);
      if (d >= start && d < end) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate(),
        ).padStart(2, "0")}`;
        days[key] = (days[key] ?? 0) + 1;
      }
    }
    return NextResponse.json({ year, month, days });
  } catch {
    return NextResponse.json({ year, month, days: {} });
  }
}
