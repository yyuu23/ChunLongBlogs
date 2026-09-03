import { excerpt } from "@/lib/utils";

/**
 * 后台 AI 编辑助手：摘要 / 标签 / 标题 / slug / 正文与说说润色。
 * 编辑器按钮（/api/admin/*）与设置页批量入口（backfill*Action）共用；
 * Key 只存服务端，与 /api/chat 复用同一套 LLM_* 环境变量。
 */

/** 喂给模型的正文上限：DeepSeek 上下文足够，但截断可控成本与延迟 */
const MAX_INPUT_CHARS = 4000;
/** 整篇润色走的是原文 Markdown，输入输出都更长，单独放宽 */
const MAX_POLISH_CHARS = 8000;

type LLMResult = { ok: true; content: string } | { ok: false; status: number; error: string };

const SYSTEM_PROMPT =
  "你是中文技术博客的编辑助手。为文章写一句简洁的摘要，用于列表页与 SEO 描述。" +
  "要求：50-90 个汉字；一段纯文本，不要引号、不要 Markdown、不要换行；" +
  '直接概括文章讲了什么，不要"本文介绍"这类套话；保持与原文一致的语言。' +
  "只输出摘要本身，不要任何前后缀。";

const TAGS_SYSTEM_PROMPT =
  "你是中文技术博客的编辑助手。根据文章的标题与正文提炼标签。要求：" +
  "输出 3-6 个标签；优先复用【现有标签列表】里语义匹配的词（保持标签库统一），" +
  "列表里没有合适的才新建；标签是具体的主题词或技术名（如 Next.js、SQLite、性能优化、随笔），" +
  '不要"技术""文章""博客"这类过于宽泛的词；中文为主，通用技术名词保留英文原文；' +
  '只输出一个 JSON 字符串数组（如 ["Next.js","部署"]），不要任何其他文字。';

const TITLE_SYSTEM_PROMPT =
  "你是中文技术博客的编辑助手。根据文章正文拟一个标题。要求：" +
  "准确概括文章主题；与正文语言一致（中文正文用中文标题）；不超过 30 个字；" +
  "不要引号、书名号、序号或任何前后缀；只输出标题本身。";

const SLUG_SYSTEM_PROMPT =
  "你是中文技术博客的编辑助手。根据文章标题（必要时参考正文）生成 URL slug。要求：" +
  "全小写英文单词，单词之间用连字符 - 连接；3 到 6 个单词、总长不超过 60 个字符；" +
  "概括文章主题即可，不要逐字翻译标题；只输出 slug 本身，不要解释。";

const POLISH_POST_PROMPT =
  "你是中文技术博客的资深编辑。对用户提供的 Markdown 文章做润色。要求：" +
  "保持作者的原意、事实、观点与第一人称语气完全不变；代码块、行内代码、链接、图片原样保留，不要改写代码；" +
  "优化章节结构（合理使用 ## / ### 标题层级）、段落切分、列表与引用，关键信息适度加粗；" +
  "修正错别字与标点，适当增加简短的过渡句让行文更连贯；" +
  "不要添加原文没有的事实、数据或结论；保持原文语言。" +
  "输出润色后的完整 Markdown 全文，不要任何解释，也不要用代码围栏包裹。";

const POLISH_MOMENT_PROMPT =
  "你是博客主人的文案助手。把这条说说改写得更轻松惬意、有生活气息：" +
  "口语化、自然，带点小幽默也可以；保持原意、事实与信息量不变；" +
  "长度与原文相近（不要超过一倍）；保留原文已有的 emoji；不要添加话题标签，不要解释。" +
  "只输出改写后的说说文字。";

function llmConfig() {
  const base =
    process.env.LLM_BASE_URL ??
    process.env.DEEPSEEK_API_BASE ??
    "https://api.deepseek.com/v1";
  const key = process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  const model = process.env.LLM_MODEL ?? "deepseek-chat";
  return { base, key, model };
}

export function llmConfigured(): boolean {
  return llmConfig().key != null;
}

/** OpenAI 兼容协议的单轮调用：六个 AI 功能共用的请求/错误样板 */
async function chatLLM(
  system: string,
  user: string,
  opts: { maxTokens: number; temperature: number; timeoutMs?: number },
): Promise<LLMResult> {
  const { base, key, model } = llmConfig();
  if (!base || !key) {
    return {
      ok: false,
      status: 503,
      error: "未配置 AI（LLM_API_KEY / DEEPSEEK_API_KEY），请在 .env 中设置后重启服务",
    };
  }
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
          { role: "user", content: user },
        ],
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: 502, error: `AI 接口返回 ${res.status}：${text.slice(0, 140)}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    // 模型偶尔会裹引号或多写一行，收口在各功能里做，这里只保证有内容
    const content = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      return { ok: false, status: 502, error: "AI 没有返回内容" };
    }
    return { ok: true, content };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, status: 504, error: "AI 响应超时，请重试" };
    }
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? `请求失败：${e.message}` : "请求失败",
    };
  }
}

/* ============ 摘要 ============ */

/** 正文去 Markdown 噪音后生成一句话摘要（编辑器按钮与批量补全共用） */
export async function summarizeContent(
  title: string,
  content: string,
): Promise<{ ok: true; summary: string } | { ok: false; status: number; error: string }> {
  const raw = content.trim();
  if (raw.length < 20) {
    return { ok: false, status: 400, error: "正文太短，先写点内容再生成摘要" };
  }
  const r = await chatLLM(
    SYSTEM_PROMPT,
    `标题：${title || "（无标题）"}\n\n正文：\n${excerpt(raw, MAX_INPUT_CHARS)}`,
    { maxTokens: 300, temperature: 0.4 },
  );
  if (!r.ok) return r;
  const summary = r.content
    .replace(/\s+/g, " ")
    .replace(/^["'“”「『]+|["'“”」』]+$/g, "")
    .trim();
  return { ok: true, summary: summary.slice(0, 200) };
}

/* ============ 标签 ============ */

/**
 * 从模型返回文本中提取 JSON 字符串数组（容错 ```json 包裹、前后多余文字），
 * 逐项清洗：去空、去超长（>20 字）、去重，上限 6 个。
 */
function parseTagArray(text: string): string[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const tag = item.trim();
    if (!tag || tag.length > 20) continue;
    seen.add(tag);
    if (seen.size >= 6) break;
  }
  return [...seen];
}

/** AI 标签建议：喂给模型时带上现有标签库（优先复用，避免同义词碎片化） */
export async function suggestTags(
  title: string,
  content: string,
  existingTags: string[],
): Promise<{ ok: true; tags: string[] } | { ok: false; status: number; error: string }> {
  const raw = content.trim();
  if (raw.length < 20) {
    return { ok: false, status: 400, error: "正文太短，先写点内容再生成标签" };
  }
  const r = await chatLLM(
    TAGS_SYSTEM_PROMPT,
    `标题：${title || "（无标题）"}\n\n正文：\n${excerpt(raw, MAX_INPUT_CHARS)}\n\n现有标签列表：${JSON.stringify(existingTags)}`,
    { maxTokens: 200, temperature: 0.3 },
  );
  if (!r.ok) return r;
  const tags = parseTagArray(r.content);
  if (!tags.length) {
    return { ok: false, status: 400, error: "AI 返回的标签格式异常，请重试" };
  }
  return { ok: true, tags };
}

/* ============ 标题 / slug ============ */

/** AI 从正文拟标题 */
export async function suggestTitle(
  content: string,
): Promise<{ ok: true; title: string } | { ok: false; status: number; error: string }> {
  const raw = content.trim();
  if (raw.length < 20) {
    return { ok: false, status: 400, error: "正文太短，先写点内容再生成标题" };
  }
  const r = await chatLLM(TITLE_SYSTEM_PROMPT, `正文：\n${excerpt(raw, 2000)}`, {
    maxTokens: 100,
    temperature: 0.6,
  });
  if (!r.ok) return r;
  const title = r.content
    .replace(/\s+/g, " ")
    .replace(/^["'“”「『《]+|["'“”」』》]+$/g, "")
    .trim()
    .slice(0, 40);
  if (!title) return { ok: false, status: 502, error: "AI 没有返回内容" };
  return { ok: true, title };
}

/** AI 生成英文 URL slug（中文名 slugify 后还是中文，AI 能给出体面的英文短 slug） */
export async function suggestSlug(
  title: string,
  content: string,
): Promise<{ ok: true; slug: string } | { ok: false; status: number; error: string }> {
  if (!title.trim() && content.trim().length < 20) {
    return { ok: false, status: 400, error: "先写标题或正文再生成 slug" };
  }
  const r = await chatLLM(
    SLUG_SYSTEM_PROMPT,
    `标题：${title.trim() || "（无标题）"}\n\n正文：\n${excerpt(content, 800)}`,
    { maxTokens: 60, temperature: 0.3 },
  );
  if (!r.ok) return r;
  const slug = r.content
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!slug) return { ok: false, status: 400, error: "AI 生成的 slug 无效，请重试" };
  return { ok: true, slug };
}

/* ============ 润色 ============ */

/** 剥掉模型不听话时裹的 ```markdown 围栏 */
function stripCodeFence(text: string): string {
  const m = text.trim().match(/^```[\w-]*\s*\n([\s\S]*?)\n?```$/);
  return m ? m[1]!.trim() : text.trim();
}

/**
 * 整篇 Markdown 润色：输入必须是原始 Markdown（不走 excerpt 清洗，格式要保留）。
 * 生成长文耗时明显，超时放宽到 90 秒。
 */
export async function polishPost(
  title: string,
  content: string,
): Promise<{ ok: true; content: string } | { ok: false; status: number; error: string }> {
  const raw = content.trim();
  if (raw.length < 20) {
    return { ok: false, status: 400, error: "正文太短，先写点内容再润色" };
  }
  if (raw.length > MAX_POLISH_CHARS) {
    return {
      ok: false,
      status: 400,
      error: `正文超过 ${MAX_POLISH_CHARS} 字，暂不支持整篇润色，可分篇处理`,
    };
  }
  const r = await chatLLM(
    POLISH_POST_PROMPT,
    `标题：${title.trim() || "（无标题）"}\n\n正文：\n${raw}`,
    { maxTokens: 4096, temperature: 0.5, timeoutMs: 90_000 },
  );
  if (!r.ok) return r;
  return { ok: true, content: stripCodeFence(r.content) };
}

/** 说说润色：语气更轻松惬意，原意与信息量不变 */
export async function polishMoment(
  content: string,
): Promise<{ ok: true; content: string } | { ok: false; status: number; error: string }> {
  const raw = content.trim();
  if (raw.length < 10) {
    return { ok: false, status: 400, error: "先写点内容再润色" };
  }
  if (raw.length > 800) {
    return { ok: false, status: 400, error: "说说超过 800 字，精简一点再润色吧" };
  }
  const r = await chatLLM(POLISH_MOMENT_PROMPT, raw, { maxTokens: 600, temperature: 0.7 });
  if (!r.ok) return r;
  return { ok: true, content: stripCodeFence(r.content).replace(/\s+/g, " ").trim() };
}
