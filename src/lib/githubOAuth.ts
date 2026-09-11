import { cookies } from "next/headers";
import { isSecureRequest } from "@/lib/auth";

/** OAuth 往返用的短时 state cookie（10 分钟，防 CSRF） */
export const OAUTH_STATE_COOKIE = "cl_oauth";

export function githubOAuthConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

/** 请求对外 origin：生产在 nginx 反代后面，靠 x-forwarded-* 还原真实协议/域名 */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export function callbackUrl(req: Request): string {
  return `${requestOrigin(req)}/api/auth/github/callback`;
}

export interface OAuthState {
  state: string;
  /** 登录成功后跳回的站内路径 */
  returnTo: string;
  /** 登录前浏览器上的匿名访客 ID：用于把游客时期点的赞回填到该 GitHub 账号名下 */
  visitorId: string;
}

export async function saveOAuthState(data: OAuthState) {
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: 600,
  });
}

/** 读出并立即作废（一次性），避免回放 */
export async function readOAuthState(): Promise<OAuthState | null> {
  const jar = await cookies();
  const raw = jar.get(OAUTH_STATE_COOKIE)?.value;
  if (!raw) return null;
  jar.delete(OAUTH_STATE_COOKIE);
  try {
    const parsed = JSON.parse(raw) as OAuthState;
    if (typeof parsed.state !== "string" || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 只接受站内相对路径——returnTo 来自 query 参数，不校验会是开放重定向漏洞 */
export function safeReturnTo(value: string | null | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}
