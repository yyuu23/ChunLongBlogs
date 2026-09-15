import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { incrStat, markVisit, type VisitMilestone } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** 里程碑阈值：每日第 1 位 + 第 10 整倍数（判定单一来源在服务端） */
function isMilestone(m: VisitMilestone): boolean {
  return m.n === 1 || m.n % 10 === 0;
}

/**
 * 匿名行为埋点（fire-and-forget）：只接收白名单事件，IP 限流防刷，
 * 不存 IP/UA——仅按天聚合计数与访客日去重（见 lib/stats.ts）。
 * 响应可能带 milestone：该访客是今日第 n 位且命中庆祝阈值（老客户端忽略无碍）。
 */
export async function POST(request: Request) {
  const rl = rateLimit(`stats:${clientIp(request)}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  const body = (await request.json().catch(() => null)) as {
    type?: unknown;
    page?: unknown;
    visitorId?: unknown;
  } | null;
  if (body?.type !== "visit") return NextResponse.json({ ok: false }, { status: 400 });

  // 路径白名单清洗：站内路径字符，去 query/hash
  const page =
    typeof body.page === "string" && /^\/[a-zA-Z0-9\-_/.]*$/.test(body.page)
      ? body.page.slice(0, 64)
      : "";
  const vid = typeof body.visitorId === "string" ? body.visitorId.slice(0, 64) : "";

  void incrStat("pv", page || "/");
  const milestone = vid ? await markVisit(vid) : null;
  return NextResponse.json({
    ok: true,
    ...(milestone && isMilestone(milestone) ? { milestone } : {}),
  });
}
