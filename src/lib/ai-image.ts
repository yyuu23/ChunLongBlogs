/**
 * 智谱 CogView 文生图（AI 生成文章封面用）。仅依赖 GLM key
 * （LLM_API_KEY / GLM_API_KEY），与聊天/写作助手的供应商配置互不影响。
 * 返回统一为 base64（CogView 可能返回 url 或 b64_json，url 时服务端代拉一次）。
 */

export function cogviewModel(): string {
  return process.env.COGVIEW_MODEL ?? "cogview-3-flash";
}

export function cogviewConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY ?? process.env.GLM_API_KEY);
}

export type GenImageResult =
  | { ok: true; b64: string }
  | { ok: false; status: number; error: string };

/** 生成一张图（默认封面比例 1440×720）。失败信息可直接展示给站长。 */
export async function genImage(
  prompt: string,
  size = "1440x720",
  signal?: AbortSignal,
): Promise<GenImageResult> {
  const key = process.env.LLM_API_KEY ?? process.env.GLM_API_KEY;
  if (!key) return { ok: false, status: 503, error: "未配置智谱 API Key（GLM_API_KEY），无法生成封面" };
  const base = (process.env.GLM_API_BASE ?? process.env.LLM_API_BASE ?? "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: cogviewModel(), prompt: prompt.slice(0, 500), size }),
      signal: signal ?? AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: 502, error: `图像接口返回 ${res.status}：${text.slice(0, 140)}` };
    }
    const data = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };
    const item = data.data?.[0];
    if (item?.b64_json) return { ok: true, b64: item.b64_json };
    if (item?.url) {
      // 返回外链时服务端代拉转 base64（统一交给 sharp 处理）
      const img = await fetch(item.url, { signal: signal ?? AbortSignal.timeout(30_000) });
      if (!img.ok) return { ok: false, status: 502, error: "生成图片下载失败" };
      const buf = Buffer.from(await img.arrayBuffer());
      return { ok: true, b64: buf.toString("base64") };
    }
    return { ok: false, status: 502, error: "图像接口没有返回图片" };
  } catch (e) {
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      return { ok: false, status: 504, error: "生成超时（CogView 通常 5-15 秒），请重试" };
    }
    return { ok: false, status: 502, error: e instanceof Error ? `生成失败：${e.message}` : "生成失败" };
  }
}
