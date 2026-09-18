import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { DICTIONARIES, translate } from "@/lib/i18n";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function slugify(input: string) {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return s || `post-${Date.now().toString(36)}`;
}

export function formatDate(d: Date | string | number | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function formatDateTime(d: Date | string | number | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function relativeTime(
  d: Date | string | number,
  locale: Locale = DEFAULT_LOCALE,
) {
  const diff = Date.now() - new Date(d).getTime();
  const min = 60_000,
    hour = 3_600_000,
    day = 86_400_000;
  const dict = DICTIONARIES[locale];
  if (diff < min) return translate(dict, "time.justNow");
  if (diff < hour) return translate(dict, "time.minutesAgo", { n: Math.floor(diff / min) });
  if (diff < day) return translate(dict, "time.hoursAgo", { n: Math.floor(diff / hour) });
  if (diff < 30 * day) return translate(dict, "time.daysAgo", { n: Math.floor(diff / day) });
  return formatDate(d);
}

/** 中文语境字数统计：CJK 计字符，英文计单词 */
export function countWords(markdown: string) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ");
  const cjk = plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)?.length ?? 0;
  const latin = plain.match(/[a-zA-Z0-9]+/g)?.length ?? 0;
  return cjk + latin;
}

export function readingTimeMinutes(markdown: string) {
  return Math.max(1, Math.round(countWords(markdown) / 300));
}

export function excerpt(markdown: string, len = 120) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > len ? `${plain.slice(0, len)}…` : plain;
}
