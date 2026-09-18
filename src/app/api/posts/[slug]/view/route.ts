import { NextResponse } from "next/server";
import { eq, sql, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { clientIp } from "@/lib/shared/rate-limit";
import { assertSameOrigin, publicWriteErrorResponse, quotaResponse } from "@/lib/public-write/guard";
import { attachAnonymousVisitorCookie, resolveAnonymousVisitor } from "@/lib/public-write/identity";
import { burstQuota, persistentQuota } from "@/lib/public-write/quota";

export const dynamic = "force-dynamic";

/** 阅读量自增：POST /api/posts/[slug]/view */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return publicWriteErrorResponse(error) ?? NextResponse.json({ error: "internal" }, { status: 500 });
  }
  const { slug } = await params;
  const legacyVisitorId = new URL(request.url).searchParams.get("visitorId");
  const visitor = await resolveAnonymousVisitor(request, legacyVisitorId);
  const ip = clientIp(request);
  const burst = burstQuota("post-view", "ip", ip, 30, 60_000);
  const visitorWindow = persistentQuota(`post-view:${slug}`, "visitor", visitor.visitorId, 1, 6 * 60 * 60_000);
  const ipDaily = persistentQuota("post-view", "ip", ip, 120, 24 * 60 * 60_000);
  if (!burst.ok || !visitorWindow.ok || !ipDaily.ok) {
    return attachAnonymousVisitorCookie(
      quotaResponse(Math.max(burst.retryAfter, visitorWindow.retryAfter, ipDaily.retryAfter)),
      request,
      visitor,
    );
  }
  const updated = await db
    .update(posts)
    .set({ views: sql`${posts.views} + 1` })
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")))
    .returning({ views: posts.views });

  if (!updated.length) {
    return attachAnonymousVisitorCookie(
      NextResponse.json({ error: "not found" }, { status: 404 }),
      request,
      visitor,
    );
  }
  return attachAnonymousVisitorCookie(NextResponse.json({ views: updated[0].views }), request, visitor);
}
