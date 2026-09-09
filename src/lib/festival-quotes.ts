/** 节气瓶中信：站长语录的文本格式与配置对象互转（admin textarea ↔ site config）。 */

/** 文本 → 配置：每行 `key | 语录`，容忍空行与缺分隔符的行（跳过）。 */
export function parseFestivalQuotes(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf("|");
    if (sep <= 0) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

/** 配置 → 文本：稳定顺序（按 key 排序），roundtrip 无损。 */
export function stringifyFestivalQuotes(quotes: Record<string, string> | undefined | null): string {
  return Object.keys(quotes ?? {})
    .sort()
    .map((k) => `${k} | ${quotes![k]}`)
    .join("\n");
}
