import { NextResponse } from "next/server";
import { clientIp } from "@/lib/rateLimit";
import { incrStat, markVisit, type VisitMilestone } from "@/lib/stats";
import { checkScheduledPosts } from "@/lib/scheduled";
import { assertSameOrigin, publicWriteErrorResponse, quotaResponse } from "@/lib/public-write/guard";
import { attachAnonymousVisitorCookie, resolveAnonymousVisitor } from "@/lib/public-write/identity";
import { readJson } from "@/lib/public-write/json";
import { burstQuota, persistentQuota } from "@/lib/public-write/quota";
import { statsVisitSchema } from "@/lib/public-write/schemas";

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
  let body;
  try {
    assertSameOrigin(request);
    body = await readJson(request, statsVisitSchema, 2 * 1024);
  } catch (error) {
    return publicWriteErrorResponse(error) ?? NextResponse.json({ ok: false }, { status: 500 });
  }
  const visitor = await resolveAnonymousVisitor(request, body.visitorId);
  const ip = clientIp(request);
  const burst = burstQuota("stats", "ip", ip, 60, 60_000);
  const daily = persistentQuota("stats", "ip", ip, 1000, 24 * 60 * 60_000);
  if (!burst.ok || !daily.ok) {
    return attachAnonymousVisitorCookie(
      quotaResponse(Math.max(burst.retryAfter, daily.retryAfter)),
      request,
      visitor,
    );
  }

  // 路径白名单清洗：站内路径字符，去 query/hash
  const page =
    /^\/[a-zA-Z0-9\-_/.]*$/.test(body.page)
      ? body.page.slice(0, 64)
      : "";

  // 定时发布惰性触发（60s 节流，fire-and-forget）
  void checkScheduledPosts();
  void incrStat("pv", page || "/");
  const milestone = await markVisit(visitor.visitorId);
  return attachAnonymousVisitorCookie(
    NextResponse.json({
      ok: true,
      ...(milestone && isMilestone(milestone) ? { milestone } : {}),
    }),
    request,
    visitor,
  );
}
