import path from "node:path";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { requireAdminApi } from "@/lib/auth/admin-session";
import { clientIp, rateLimit } from "@/lib/shared/rate-limit";
import { incrStat } from "@/lib/analytics/stats";
import { cogviewConfigured, genImage } from "@/lib/ai/image";

export const dynamic = "force-dynamic";

/**
 * AI 生成文章封面（后台专用）：CogView 按 prompt 出图 → sharp 统一裁
 * 1600×750 WebP（不同档位尺寸漂移兜底）→ 落盘 public/uploads。
 * 按张计费，限流 3 次/分钟，未配置 GLM key 返回 503。
 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }
  const rl = rateLimit(`gencover:${clientIp(request)}`, 3, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: `太快了，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  if (!cogviewConfigured()) {
    return Response.json({ error: "未配置智谱 API Key（GLM_API_KEY），无法生成封面" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 4 || prompt.length > 500) {
    return Response.json({ error: "请求格式错误：prompt 应为 4-500 字" }, { status: 400 });
  }

  const r = await genImage(prompt, "1440x720");
  if (!r.ok) {
    return Response.json({ error: r.error }, { status: r.status });
  }

  try {
    const output = await sharp(Buffer.from(r.b64, "base64"))
      .resize(1600, 750, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${randomBytes(4).toString("hex")}.webp`;
    await writeFile(path.join(dir, name), output);
    void incrStat("ai_tool", "生成封面");
    return Response.json({ url: `/uploads/${name}` });
  } catch {
    return Response.json({ error: "生成图片处理失败，请重试" }, { status: 500 });
  }
}
