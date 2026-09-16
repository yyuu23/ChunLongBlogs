/** 对话导出/分享卡的纯函数（客户端专用；vitest 可直接测） */

export interface ExportMsg {
  role: "user" | "assistant";
  content: string;
}

/** 整场对话 → Markdown（跳过空消息；站点名由调用方拼进标题） */
export function buildChatMarkdown(title: string, msgs: ExportMsg[], siteName: string): string {
  const date = new Date().toLocaleDateString("zh-CN");
  const lines: string[] = [`# ${siteName} · ${title}`, `> ${date} · 与 ${siteName} AI 的对话`, ""];
  for (const m of msgs) {
    if (!m.content.trim()) continue;
    lines.push(`**${m.role === "user" ? "🧑 我" : "🐱 助手"}：**`, "", m.content.trim(), "");
  }
  return lines.join("\n");
}

/** 触发浏览器下载（Blob → a[download] → revoke） */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 最小测宽接口（canvas 2d 与测试 fake 都满足） */
export interface TextMeasurer {
  measureText(s: string): { width: number };
}

/**
 * canvas 文本断行：逐字符累积 + measureText（CJK 无空格也能断）；
 * 超过 maxLines 末行截断加省略号。用 Array.from 按 Unicode 码位迭代，
 * emoji 代理对不会被从中间切断。
 */
export function wrapCanvasText(
  ctx: TextMeasurer,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chars = Array.from(text);
  const lines: string[] = [];
  let current = "";
  for (const ch of chars) {
    if (ctx.measureText(current + ch).width > maxWidth && current) {
      lines.push(current);
      current = ch;
      if (lines.length >= maxLines) break;
    } else {
      current += ch;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  // 超行截断：末行替换为自身前缀 + …
  if (lines.length === maxLines) {
    const consumed = lines.join("").length;
    if (consumed < chars.length) {
      let last = lines[maxLines - 1]!;
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = Array.from(last).slice(0, -1).join("");
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}
