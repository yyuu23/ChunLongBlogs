import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { excerpt } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 喂给模型的正文上限：DeepSeek 上下文足够，但截断可控成本与延迟 */
const MAX_INPUT_CHARS = 4000;

/**
 * AI 生成文章摘要（后台专用）：正文去 Markdown 噪音 → OpenAI 兼容协议 → 返回一句话摘要。
 * Key 只存服务端，与 /api/chat 复用同一套 LLM_* 环境变量。
 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 限流：即便是后台，也防手抖连点把额度打空
  const rl = rateLimit(`summarize:${clientIp(request)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `太快了，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const base =
    process.env.LLM_BASE_URL ??
    process.env.DEEPSEEK_API_BASE ??
    "https://api.deepseek.com/v1";
  const key = process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  const model = process.env.LLM_MODEL ?? "deepseek-chat";

  if (!base || !key) {
    return NextResponse.json(
      { error: "未配置 AI（LLM_API_KEY / DEEPSEEK_API_KEY），请在 .env 中设置后重启服务" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    content?: string;
  } | null;
  const title = (body?.title ?? "").trim();
  const raw = (body?.content ?? "").trim();
  if (raw.length < 20) {
    return NextResponse.json({ error: "正文太短，先写点内容再生成摘要" }, { status: 400 });
  }

  // 复用前台摘要的清洗逻辑：去代码块/行内代码/链接/Markdown 标记
  const plain = excerpt(raw, MAX_INPUT_CHARS);

  const system =
    "你是中文技术博客的编辑助手。为文章写一句简洁的摘要，用于列表页与 SEO 描述。" +
    "要求：50-90 个汉字；一段纯文本，不要引号、不要 Markdown、不要换行；" +
    '直接概括文章讲了什么，不要"本文介绍"这类套话；保持与原文一致的语言。' +
    "只输出摘要本身，不要任何前后缀。";

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `标题：${title || "（无标题）"}\n\n正文：\n${plain}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.4,
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `AI 接口返回 ${res.status}：${text.slice(0, 140)}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    // 模型偶尔会裹引号或多写一行，这里做一次收口
    const summary = (data.choices?.[0]?.message?.content ?? "")
      .replace(/\s+/g, " ")
      .replace(/^["'“”「『]+|["'“”」』]+$/g, "")
      .trim();
    if (!summary) {
      return NextResponse.json({ error: "AI 没有返回内容" }, { status: 502 });
    }
    return NextResponse.json({ summary: summary.slice(0, 200) });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "AI 响应超时，请重试" }, { status: 504 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? `请求失败：${e.message}` : "请求失败" },
      { status: 502 },
    );
  }
}
