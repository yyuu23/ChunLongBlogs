import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { githubUsers } from "@/lib/db/schema";
import { sessionSecret, isSecureRequest } from "@/lib/auth";

/** GitHub 访客会话（与 cl_admin 完全独立的 cookie，互不干扰） */
const COOKIE_NAME = "cl_user";

export interface VisitorSession {
  userId: number;
}

export async function createUserSession(userId: number) {
  const token = await new SignJWT({ role: "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(sessionSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getUserSession(): Promise<VisitorSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.role !== "user" || !payload.sub) return null;
    const userId = Number(payload.sub);
    return Number.isInteger(userId) && userId > 0 ? { userId } : null;
  } catch {
    return null;
  }
}

export async function destroyUserSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export interface VisitorUser {
  id: number;
  login: string;
  avatarUrl: string;
  bio: string;
}

/** 当前登录访客的公开资料（每次读库，头像/昵称随最近一次登录刷新） */
export async function getCurrentUser(): Promise<VisitorUser | null> {
  const session = await getUserSession();
  if (!session) return null;
  const rows = await db
    .select({
      id: githubUsers.id,
      login: githubUsers.login,
      avatarUrl: githubUsers.avatarUrl,
      bio: githubUsers.bio,
    })
    .from(githubUsers)
    .where(eq(githubUsers.id, session.userId))
    .limit(1);
  return rows[0] ?? null;
}
