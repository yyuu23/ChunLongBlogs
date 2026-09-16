import { NextResponse } from "next/server";
import { PublicWriteError } from "./json";

function forwardedOrigin(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? new URL(request.url).protocol.slice(0, -1);
  return `${proto}://${host}`;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = new Set<string>([new URL(request.url).origin]);
  const forwarded = forwardedOrigin(request);
  if (forwarded) allowed.add(forwarded);
  if (process.env.SITE_URL) {
    try {
      allowed.add(new URL(process.env.SITE_URL).origin);
    } catch {
      // 启动配置校验另行负责；这里保持安全地不加入非法值。
    }
  }
  if (!allowed.has(origin)) throw new PublicWriteError(403, "cross_origin_forbidden");
}

export function quotaResponse(retryAfter: number, message = "rate limited") {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } },
  );
}

export function publicWriteErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof PublicWriteError)) return null;
  return NextResponse.json({ error: error.code }, { status: error.status });
}
