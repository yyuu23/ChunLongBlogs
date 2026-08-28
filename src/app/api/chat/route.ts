import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** AI 聊天代理：OpenAI 兼容协议，Key 只存服务端
 * 兼容两种变量名：LLM_*（通用）或 DeepSeek 官方文档风格的 DEEPSEEK_API_KEY / DEEPSEEK_API_BASE */
export async function POST(request: Request) {
  const base =
    process.env.LLM_BASE_URL ??
    process.env.DEEPSEEK_API_BASE ??
    "https://api.deepseek.com/v1";
  const key = process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY;
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
  const persona = config.aiPersona || "你是 ChunLong Blog 的看板娘助手，回答简洁友好，偶尔用一点颜文字。";
  // 注入站点事实，避免模型在"本站"相关问题上幻觉
  const facts = [
    `本站名：${config.siteName}，站长：${config.authorName}。`,
    "本站技术栈：Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS v4 + framer-motion + SQLite（Drizzle ORM），是站长自研的全栈博客（不是 Hugo/Hexo/WordPress）。",
    "本站主要功能：文章博客（Markdown/代码高亮/评论 giscus）、说说、相册（拍立得照片墙）、友链、音乐馆（跨页不断播的全局播放器）、three.js 实验室（/lab）、Live2D 看板娘（就是我）、五套主题色换装、樱花/萤火虫/落叶/落雪粒子主题、天气卡、导航日历。",
    "管理后台在 /admin；本项目开源于 GitHub（yyuu23/ChunLongBlogs）。",
  ].join("\n");
  const system = `${persona}\n\n[以下为本站事实信息，回答站点相关问题时必须以此为准，不知道的就说不知道]\n${facts}`;

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
