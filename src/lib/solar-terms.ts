/**
 * 二十四节气近似计算（误差 ±1 天，用于公告栏展示足够）。
 * 每个节气在公历中的日期每年浮动很小，取常见日期即可。
 */

export interface SolarTerm {
  name: string;
  en: string;
  month: number; // 1-12
  day: number; // 常见日期
}

const TERMS: SolarTerm[] = [
  { name: "小寒", en: "Minor Cold", month: 1, day: 6 },
  { name: "大寒", en: "Major Cold", month: 1, day: 20 },
  { name: "立春", en: "Start of Spring", month: 2, day: 4 },
  { name: "雨水", en: "Rain Water", month: 2, day: 19 },
  { name: "惊蛰", en: "Awakening of Insects", month: 3, day: 6 },
  { name: "春分", en: "Spring Equinox", month: 3, day: 21 },
  { name: "清明", en: "Pure Brightness", month: 4, day: 5 },
  { name: "谷雨", en: "Grain Rain", month: 4, day: 20 },
  { name: "立夏", en: "Start of Summer", month: 5, day: 6 },
  { name: "小满", en: "Grain Buds", month: 5, day: 21 },
  { name: "芒种", en: "Grain in Ear", month: 6, day: 6 },
  { name: "夏至", en: "Summer Solstice", month: 6, day: 21 },
  { name: "小暑", en: "Minor Heat", month: 7, day: 7 },
  { name: "大暑", en: "Major Heat", month: 7, day: 23 },
  { name: "立秋", en: "Start of Autumn", month: 8, day: 8 },
  { name: "处暑", en: "End of Heat", month: 8, day: 23 },
  { name: "白露", en: "White Dew", month: 9, day: 8 },
  { name: "秋分", en: "Autumn Equinox", month: 9, day: 23 },
  { name: "寒露", en: "Cold Dew", month: 10, day: 8 },
  { name: "霜降", en: "Frost's Descent", month: 10, day: 23 },
  { name: "立冬", en: "Start of Winter", month: 11, day: 7 },
  { name: "小雪", en: "Minor Snow", month: 11, day: 22 },
  { name: "大雪", en: "Major Snow", month: 12, day: 7 },
  { name: "冬至", en: "Winter Solstice", month: 12, day: 22 },
];

export function seasonOf(date: Date): { name: string; emoji: string } {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return { name: "春", emoji: "🌸" };
  if (m >= 6 && m <= 8) return { name: "夏", emoji: "🌿" };
  if (m >= 9 && m <= 11) return { name: "秋", emoji: "🍁" };
  return { name: "冬", emoji: "❄️" };
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

export function solarTermText(date = new Date()) {
  const term = currentSolarTerm(date);
  const season = seasonOf(date);
  return {
    term,
    season,
    text: `${term.name} · ${term.en}`,
    dateText: `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${season.name}季 ${season.emoji}`,
  };
}
