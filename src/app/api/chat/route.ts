import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/site";
import { retrieveContext } from "@/lib/rag";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** related 的公开形态：文章带 slug 链接，说说没有独立页面（锚点到 /moments） */
interface RelatedItem {
  kind: "post" | "moment";
  title?: string;
  slug?: string;
  momentId?: number;
  date?: string;
}

/** SSE 帧格式：`event: <name>\ndata: <json>\n\n` */
function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * AI 聊天代理：RAG 检索博客文章与说说 → 注入上下文 → OpenAI 兼容协议回答（Key 只存服务端）。
 * body 加 stream?: true 时以 SSE 流式返回（related → delta* → done/error）。
 */
export async function POST(request: Request) {
  // 限流：同 IP 每分钟 CHAT_RATE_LIMIT(默认 20) 次
  const limit = Number(process.env.CHAT_RATE_LIMIT) || 20;
  const rl = rateLimit(`chat:${clientIp(request)}`, limit, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limited" },
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
      { error: "站长还没有配置 AI（LLM_API_KEY / DEEPSEEK_API_KEY），请在 .env 中设置后重启服务" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: ChatMessage[];
    stream?: boolean;
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
    "本站主要功能：文章博客（Markdown/代码高亮/评论 giscus）、说说、相册（拍立得照片墙）、友链、音乐馆（跨页不断播的全局播放器）、three.js 实验室（/lab）、Live2D 看板娘（就是我）、五套主题色换装、樱花/萤火虫/落叶/落雪粒子主题、天气卡、导航日历、AI 问答（/chat）。",
    "管理后台在 /admin；本项目开源于 GitHub（yyuu23/ChunLongBlogs）。",
  ].join("\n");

  // ===== RAG：检索与最新提问最相关的文章与说说 =====
  const lastQuestion = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  let ragBlock = "";
  const related: RelatedItem[] = [];
  try {
    const { mode, hits } = await retrieveContext(lastQuestion, 3);
    if (hits.length) {
      for (const h of hits) {
        if (h.kind === "post") related.push({ kind: "post", title: h.title, slug: h.slug });
        else related.push({ kind: "moment", momentId: h.momentId, date: h.date });
      }
      ragBlock =
        `\n\n[以下是站内文章与说说中与用户问题最相关的片段${mode === "vector" ? "（语义检索）" : "（关键词检索）"}，回答依据优先从这里找，找不到再用自己的知识并说明]\n` +
        hits
          .map((h) =>
            h.kind === "post"
              ? `--- 文章《${h.title}》(链接 /posts/${h.slug}) ---\n${h.chunk}`
              : `--- 说说（发布于 ${h.date}，无独立页面，来自 /moments）---\n${h.chunk}`,
          )
          .join("\n\n");
    }
  } catch (e) {
    console.error("[rag] retrieve failed:", e);
  }

  const system =
    `${persona}\n\n[以下为本站事实信息，回答站点相关问题时必须以此为准，不知道的就说不知道]\n${facts}${ragBlock}`;

  const streamMode = body?.stream === true;

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
        max_tokens: 1024,
        temperature: 0.7,
        ...(streamMode ? { stream: true } : {}),
      }),
      // 流式给更长时间；客户端断开时 request.signal 联动取消上游请求
      signal: streamMode
        ? AbortSignal.any([request.signal, AbortSignal.timeout(60_000)])
        : AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `AI 接口返回 ${res.status}：${text.slice(0, 140)}` },
        { status: 502 },
      );
    }

    /* ===== 非流式：原行为，一次性 JSON ===== */
    if (!streamMode) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) return NextResponse.json({ error: "AI 没有返回内容" }, { status: 502 });
      const relatedLinks = related.length
        ? "\n\n" +
          related
            .map((r) =>
              r.kind === "post"
                ? `📄 相关文章：《${r.title}》（/posts/${r.slug}）`
                : `💭 相关说说：发布于 ${r.date} 的那条（/moments）`,
            )
            .join("\n")
        : "";
      return NextResponse.json({ reply: reply + relatedLinks, related });
    }

    /* ===== 流式：SSE 转发（related 先行 → delta* → done） ===== */
    const upstream = res.body;
    if (!upstream) return NextResponse.json({ error: "AI 没有返回流" }, { status: 502 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (frame: string) => {
          try {
            controller.enqueue(encoder.encode(frame));
          } catch {
            // close 之后再 enqueue 会抛，忽略即可
          }
        };
        // 检索已完成：首 token 前的等待期 UI 就能渲染来源卡片
        send(sse("related", related));

        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sentDone = false;
        const finish = () => {
          if (!sentDone) {
            sentDone = true;
            send(sse("done", {}));
          }
        };
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? ""; // 最后一段可能不完整，留到下一块
            for (const line of lines) {
              const trimmed = line.trim();
              // SSE 注释行（DeepSeek keep-alive 的 ": keep-alive"）与空行跳过
              if (!trimmed || trimmed.startsWith(":")) continue;
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                finish();
                continue;
              }
              try {
                const parsed = JSON.parse(data) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) send(sse("delta", { text }));
              } catch {
                // 单帧解析失败不中断整流
              }
            }
          }
          finish(); // 上游结束但没发 [DONE] 的保险
        } catch (e) {
          // 客户端断开/超时：静默收尾，已生成的部分已发出
          if (!(e instanceof Error && e.name === "AbortError")) {
            send(sse("error", { message: "stream interrupted" }));
          }
        } finally {
          reader.releaseLock();
          try {
            controller.close();
          } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        // 关键：nginx 反代默认缓冲响应，会把 SSE 攒成一坨，必须显式禁用
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `请求失败：${e.message}` : "请求失败" },
      { status: 502 },
    );
  }
}
