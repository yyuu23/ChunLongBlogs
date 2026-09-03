"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, HTML_LANG, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { DICTIONARIES, translate, translateList, type TParams } from "@/lib/i18n";
import { trackEvent } from "@/lib/track";

export type T = (key: string, params?: TParams) => string;
export type TArr = (key: string) => string[];

interface LocaleCtx {
  locale: Locale;
  t: T;
  tArr: TArr;
  setLocale: (locale: Locale) => void;
}

const Ctx = createContext<LocaleCtx>({
  locale: DEFAULT_LOCALE,
  t: (key, params) => translate(DICTIONARIES[DEFAULT_LOCALE], key, params),
  tArr: (key) => translateList(DICTIONARIES[DEFAULT_LOCALE], key),
  setLocale: () => {},
});

export const useLocale = () => useContext(Ctx);

/** 客户端组件里只取翻译函数：const t = useT() */
export const useT = (): T => useContext(Ctx).t;

/**
 * 语言上下文：初始值来自服务端 cookie（首屏即正确语言，无闪烁）；
 * 切换时写 cookie + 更新状态 + router.refresh() 让服务端组件同步换语言。
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  // setLocale 回调是 useCallback([router])，闭包里的 locale 会过期，用 ref 同步最新值
  const localeRef = useRef(initialLocale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  const t = useCallback<T>(
    (key, params) => translate(DICTIONARIES[locale], key, params),
    [locale],
  );
  const tArr = useCallback<TArr>(
    (key) => translateList(DICTIONARIES[locale], key),
    [locale],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      // 语言切换器把当前语言也渲染成可点按钮，点了不算切换
      if (next === localeRef.current) return;
      localeRef.current = next;
      trackEvent("switch_locale", { locale: next });
      setLocaleState(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = HTML_LANG[next];
      router.refresh();
    },
    [router],
  );

  return <Ctx.Provider value={{ locale, t, tArr, setLocale }}>{children}</Ctx.Provider>;
}
