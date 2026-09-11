export const dynamic = "force-dynamic";

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  githubOAuthConfigured,
  callbackUrl,
  saveOAuthState,
  safeReturnTo,
} from "@/lib/githubOAuth";

const UNCONFIGURED_HTML = `<!doctype html><html lang="zh"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GitHub 登录未配置</title>
<body style="font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5">
<div style="max-width:28rem;padding:2rem;text-align:center;line-height:1.8">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">GitHub 登录尚未配置</h1>
<p style="margin:0;color:#a3a3a3">站长还没有填写 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET，暂时无法登录评论。<br>
<a href="/" style="color:#7aa2f7">返回首页</a></p>
</div></body></html>`;

export async function GET(req: Request) {
  if (!githubOAuthConfigured()) {
    return new NextResponse(UNCONFIGURED_HTML, {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const url = new URL(req.url);
  const state = randomBytes(24).toString("hex");
  const visitorId = (url.searchParams.get("visitorId") ?? "").trim().slice(0, 64);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  await saveOAuthState({ state, returnTo, visitorId });

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  authorize.searchParams.set("redirect_uri", callbackUrl(req));
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  return NextResponse.redirect(authorize.toString());
}
