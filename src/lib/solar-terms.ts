/**
 * 二十四节气近似计算（误差 ±1 天，用于公告栏展示足够）。
 * 每个节气在公历中的日期每年浮动很小，取常见日期即可。
 * 名称多语：中文汉字 / 英译 / 日文汉字形 / 韩文音读。
 */
import { DEFAULT_LOCALE, type Locale, type LText, pick } from "@/lib/i18n/config";

export interface SolarTerm {
  name: LText;
  month: number; // 1-12
  day: number; // 常见日期
}

const TERMS: SolarTerm[] = [
  { name: { zh: "小寒", en: "Minor Cold", ja: "小寒", ko: "소한" }, month: 1, day: 6 },
  { name: { zh: "大寒", en: "Major Cold", ja: "大寒", ko: "대한" }, month: 1, day: 20 },
  { name: { zh: "立春", en: "Start of Spring", ja: "立春", ko: "입춘" }, month: 2, day: 4 },
  { name: { zh: "雨水", en: "Rain Water", ja: "雨水", ko: "우수" }, month: 2, day: 19 },
  { name: { zh: "惊蛰", en: "Awakening of Insects", ja: "啓蟄", ko: "경칩" }, month: 3, day: 6 },
  { name: { zh: "春分", en: "Spring Equinox", ja: "春分", ko: "춘분" }, month: 3, day: 21 },
  { name: { zh: "清明", en: "Pure Brightness", ja: "清明", ko: "청명" }, month: 4, day: 5 },
  { name: { zh: "谷雨", en: "Grain Rain", ja: "穀雨", ko: "곡우" }, month: 4, day: 20 },
  { name: { zh: "立夏", en: "Start of Summer", ja: "立夏", ko: "입하" }, month: 5, day: 6 },
  { name: { zh: "小满", en: "Grain Buds", ja: "小満", ko: "소만" }, month: 5, day: 21 },
  { name: { zh: "芒种", en: "Grain in Ear", ja: "芒種", ko: "망종" }, month: 6, day: 6 },
  { name: { zh: "夏至", en: "Summer Solstice", ja: "夏至", ko: "하지" }, month: 6, day: 21 },
  { name: { zh: "小暑", en: "Minor Heat", ja: "小暑", ko: "소서" }, month: 7, day: 7 },
  { name: { zh: "大暑", en: "Major Heat", ja: "大暑", ko: "대서" }, month: 7, day: 23 },
  { name: { zh: "立秋", en: "Start of Autumn", ja: "立秋", ko: "입추" }, month: 8, day: 8 },
  { name: { zh: "处暑", en: "End of Heat", ja: "処暑", ko: "처서" }, month: 8, day: 23 },
  { name: { zh: "白露", en: "White Dew", ja: "白露", ko: "백로" }, month: 9, day: 8 },
  { name: { zh: "秋分", en: "Autumn Equinox", ja: "秋分", ko: "추분" }, month: 9, day: 23 },
  { name: { zh: "寒露", en: "Cold Dew", ja: "寒露", ko: "한로" }, month: 10, day: 8 },
  { name: { zh: "霜降", en: "Frost's Descent", ja: "霜降", ko: "상강" }, month: 10, day: 23 },
  { name: { zh: "立冬", en: "Start of Winter", ja: "立冬", ko: "입동" }, month: 11, day: 7 },
  { name: { zh: "小雪", en: "Minor Snow", ja: "小雪", ko: "소설" }, month: 11, day: 22 },
  { name: { zh: "大雪", en: "Major Snow", ja: "大雪", ko: "대설" }, month: 12, day: 7 },
  { name: { zh: "冬至", en: "Winter Solstice", ja: "冬至", ko: "동지" }, month: 12, day: 22 },
];

const SEASONS = {
  spring: { name: { zh: "春", en: "Spring", ja: "春", ko: "봄" } as LText, emoji: "🌸" },
  summer: { name: { zh: "夏", en: "Summer", ja: "夏", ko: "여름" } as LText, emoji: "🌿" },
  autumn: { name: { zh: "秋", en: "Autumn", ja: "秋", ko: "가을" } as LText, emoji: "🍁" },
  winter: { name: { zh: "冬", en: "Winter", ja: "冬", ko: "겨울" } as LText, emoji: "❄️" },
} as const;

export function seasonOf(date: Date, locale: Locale = DEFAULT_LOCALE) {
  const m = date.getMonth() + 1;
  const s =
    m >= 3 && m <= 5 ? SEASONS.spring
    : m >= 6 && m <= 8 ? SEASONS.summer
    : m >= 9 && m <= 11 ? SEASONS.autumn
    : SEASONS.winter;
  return { name: pick(locale, s.name), emoji: s.emoji };
}

/** 返回给定日期当前所处的节气（最近一个已到来的节气） */
export function currentSolarTerm(date = new Date()) {
  const y = date.getFullYear();
  const scored = TERMS.map((t) => {
    const termDate = new Date(y, t.month - 1, t.day);
    // 跨年：1 月上旬的节气可能“还没到”，则视为去年的
    let diff = (date.getTime() - termDate.getTime()) / 86_400_000;
    if (diff < -20) diff += 365; // 归到去年
    return { term: t, diff };
  })
    .filter((x) => x.diff >= 0)
    .sort((a, b) => a.diff - b.diff);
  return scored[0]?.term ?? TERMS[TERMS.length - 1];
}
