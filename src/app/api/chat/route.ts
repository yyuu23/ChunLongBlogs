import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** AI 聊天代理：OpenAI 兼容协议，Key 只存服务端 */
export async function POST(request: Request) {
  const base = process.env.LLM_BASE_URL;
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? "deepseek-chat";

  if (!base || !key) {
    return NextResponse.json(
      { error: "站长还没有配置 AI（LLM_BASE_URL / LLM_API_KEY），请在 .env 中设置后重启服务" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: ChatMessage[];
  } | null;
  const history = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-16);

  if (!history.length) {
    return NextResponse.json({ error: "消息为空" }, { status: 400 });
  }

  const config = await getSiteConfig();
  const system = config.aiPersona || "你是 ChunLong Blog 的看板娘助手，回答简洁友好，偶尔用一点颜文字。";

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...history],
        max_tokens: 512,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
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
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: "AI 没有返回内容" }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `请求失败：${e.message}` : "请求失败" },
      { status: 502 },
    );
  }
}
