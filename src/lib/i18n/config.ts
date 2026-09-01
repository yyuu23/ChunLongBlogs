/** 支持的语言与全局约定 */
export const LOCALES = ["zh", "en", "ja", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";
/** 语言偏好写入的 cookie 名（服务端首屏与客户端切换共用） */
export const LOCALE_COOKIE = "cl-locale";

/** 语言切换器里展示的本地名称（永远用各自语言书写） */
export const LOCALE_NAMES: Record<Locale, string> = {
  zh: "中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
};

/** <html lang> 取值 */
export const HTML_LANG: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en",
  ja: "ja",
  ko: "ko",
};

/** toLocaleDateString 等日期 API 用的 BCP-47 标签 */
export const DATE_LOCALE: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en-US",
  ja: "ja-JP",
  ko: "ko-KR",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** 数据文件（行星/成就/节气等）里随语言切换的多语字段 */
export type LText = Record<Locale, string>;

/** 取当前语言的文本，缺失时回退中文 */
export function pick(l: Locale, text: LText): string {
  return text[l] ?? text.zh;
}
