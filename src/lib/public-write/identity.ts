import { createHmac, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { sessionSecret } from "@/lib/auth";

const COOKIE_NAME = "cl_visitor";
const ISSUER = "chunlong-blog";
const AUDIENCE = "anonymous-visitor";
const MAX_AGE = 60 * 60 * 24 * 365;
const SAFE_VISITOR_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/;

export interface AnonymousVisitorSession {
  visitorId: string;
  /** 没有有效签名 Cookie，需要随响应签发一个。 */
  issueCookie: boolean;
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function normalizeVisitorId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return SAFE_VISITOR_ID.test(id) ? id : null;
}

async function verifyVisitorToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.role !== "anonymous" || !payload.sub) return null;
    return normalizeVisitorId(payload.sub);
  } catch {
    return null;
  }
}

export async function resolveAnonymousVisitor(
  request: Request,
  legacyVisitorId?: unknown,
): Promise<AnonymousVisitorSession> {
  const token = cookieValue(request, COOKIE_NAME);
  if (token) {
    const visitorId = await verifyVisitorToken(token);
    if (visitorId) return { visitorId, issueCookie: false };
  }

  // 兼容旧客户端：首次升级时沿用 localStorage ID，避免丢失经验、积分与藏品。
  const visitorId = normalizeVisitorId(legacyVisitorId) ?? randomUUID();
  return { visitorId, issueCookie: true };
}

export async function attachAnonymousVisitorCookie<T extends NextResponse>(
  response: T,
  request: Request,
  session: AnonymousVisitorSession,
): Promise<T> {
  if (!session.issueCookie) return response;
  const token = await new SignJWT({ role: "anonymous" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.visitorId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(sessionSecret());
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwardedProto ? forwardedProto === "https" : new URL(request.url).protocol === "https:";
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: MAX_AGE,
  });
  return response;
}

/** 配额键只存不可逆摘要，避免把 IP 或 visitorId 写入配额表。 */
export function identityDigest(kind: "ip" | "visitor" | "user", value: string): string {
  return createHmac("sha256", sessionSecret()).update(`${kind}:${value}`).digest("hex").slice(0, 32);
}
