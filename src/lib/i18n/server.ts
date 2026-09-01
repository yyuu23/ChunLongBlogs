import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { DICTIONARIES, translate, type TParams } from "./index";

export type T = (key: string, params?: TParams) => string;

/** 服务端组件里获取语言（cookie 驱动，供 SSR 与 generateMetadata 使用） */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** 服务端组件取 t()：const { t, locale } = await getT() */
export async function getT(): Promise<{ locale: Locale; t: T }> {
  const locale = await getLocale();
  const dict = DICTIONARIES[locale];
  return { locale, t: (key, params) => translate(dict, key, params) };
}
