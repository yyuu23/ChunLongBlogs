import { zh, type Dictionary } from "./zh";
import { en } from "./en";
import { ja } from "./ja";
import { ko } from "./ko";
import type { Locale } from "./config";

export type { Dictionary };
export type TParams = Record<string, string | number>;

export const DICTIONARIES: Record<Locale, Dictionary> = { zh, en, ja, ko };

/** 取数组型词条（如看板娘随机台词）；未命中返回 [key] */
export function translateList(dict: Dictionary, key: string): string[] {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as object)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return [key];
    }
  }
  return Array.isArray(node) ? node : [key];
}

/**
 * 按 "a.b.c" 点路径取词。占位符 {x} 用 params 替换；
 * 英文等复数语言可用 "单数 | 复数" 写法，params.n === 1 时取前者。
 * 未命中时返回 key 本身，方便发现漏翻译。
 */
export function translate(dict: Dictionary, key: string, params?: TParams): string {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as object)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  if (typeof node !== "string") return key;
  let text = node;
  if (params) {
    if (typeof params.n === "number" && text.includes("|")) {
      const forms = text.split("|").map((s) => s.trim());
      text = params.n === 1 ? forms[0]! : forms[forms.length - 1]!;
    }
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
