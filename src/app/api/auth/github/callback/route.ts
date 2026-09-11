export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { githubUsers, postLikes } from "@/lib/db/schema";
import { createUserSession } from "@/lib/authUser";
import { callbackUrl, readOAuthState, requestOrigin, safeReturnTo } from "@/lib/githubOAuth";
import { logError } from "@/lib/logger";

interface GithubProfile {
  id?: number;
  login?: string;
  avatar_url?: string;
  bio?: string | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const saved = await readOAuthState();

  const origin = requestOrigin(req);
  const fail = (reason: string) => {
    const back = new URL(safeReturnTo(saved?.returnTo), origin);
    back.searchParams.set("cl_auth_error", reason);
    return NextResponse.redirect(back.toString());
  };

  if (!saved || !code || !state || state !== saved.state) return fail("state");

  try {
    // 换 token：client_secret 只在服务端出现，绝不进浏览器（Gitalk 模式的核心缺陷）
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl(req),
      }),
    });
    const tokenData = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
    if (!tokenRes.ok || !tokenData?.access_token) return fail("token");

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json" },
    });
    const profile = (await userRes.json().catch(() => null)) as GithubProfile | null;
    if (!userRes.ok || !profile?.id || !profile?.login) return fail("user");

    // upsert：老用户每次登录刷新资料（改名/换头像后头像列表跟着变）
    const row = {
      login: profile.login.slice(0, 100),
      avatarUrl: (profile.avatar_url ?? "").slice(0, 500),
      bio: (profile.bio ?? "").slice(0, 500),
    };
    const existing = await db
      .select({ id: githubUsers.id })
      .from(githubUsers)
      .where(eq(githubUsers.githubId, profile.id))
      .limit(1);
    const userId = existing[0]
      ? (await db.update(githubUsers).set(row).where(eq(githubUsers.id, existing[0].id)), existing[0].id)
      : (
          await db
            .insert(githubUsers)
            .values({ githubId: profile.id, ...row })
            .returning({ id: githubUsers.id })
        )[0].id;

    // 游客时期用同一浏览器点过的赞，归到该账号名下（头像列表从此能看到）
    if (saved.visitorId) {
      await db
        .update(postLikes)
        .set({ githubUserId: userId })
        .where(and(eq(postLikes.visitorId, saved.visitorId), isNull(postLikes.githubUserId)));
    }

    await createUserSession(userId);
    return NextResponse.redirect(new URL(safeReturnTo(saved.returnTo), origin).toString());
  } catch (err) {
    logError("github-oauth-callback", err);
    return fail("server");
  }
}
