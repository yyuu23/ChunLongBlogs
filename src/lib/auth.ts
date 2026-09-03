import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "cl_admin";
const encoder = new TextEncoder();

function secret() {
  return encoder.encode(
    process.env.AUTH_SECRET ?? "dev-secret-do-not-use-in-production",
  );
}

/**
 * 登录 cookie 是否加 Secure 按请求真实协议判断，而非 NODE_ENV：
 * 备案期间站点经 http://IP:8080 直连，若 cookie 带 Secure，浏览器会在
 * HTTP 页面上拒收它——登录每次"成功"却又立即弹回登录页。
 * nginx 透传的 x-forwarded-proto 已与访问协议一致（见 deploy/nginx 配置）。
 */
async function isSecureRequest(): Promise<boolean> {
  return ((await headers()).get("x-forwarded-proto") ?? "http") === "https";
}

export async function createSession(username: string) {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<{ username: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== "admin" || !payload.sub) return null;
    return { username: payload.sub };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** 供需要登录态的 API（如上传）使用 */
export async function requireAdminApi() {
  return (await getSession()) !== null;
}

/** 供 /admin 页面布局使用：未登录直接跳登录页 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}
