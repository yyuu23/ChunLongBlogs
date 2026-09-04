/**
 * 节气与农历节日表（服务端发瓶判定 + 客户端瓶子名解析共用）。
 * 节气用近似固定日期（每年浮动 1-2 天，对"当天来访发瓶"足够）；
 * 农历节日按年写死（key 带年份，每年各发新瓶），过期后需要续表。
 */
import { type LText } from "@/lib/i18n/config";

export interface FestivalDef {
  /** 稳定 key：节气不带年份（每个节气终其一瓶），农历节日带年份（每年新瓶） */
  key: string;
  /** "MM-DD"（节气近似）或 "YYYY-MM-DD"（农历节日） */
  date: string;
  emoji: string;
  name: LText;
}

const SOLAR_TERMS: FestivalDef[] = [
  { key: "solar-xiaohan", date: "01-06", emoji: "❄️", name: { zh: "小寒", en: "Minor Cold", ja: "小寒", ko: "소한" } },
  { key: "solar-dahan", date: "01-20", emoji: "🌨️", name: { zh: "大寒", en: "Major Cold", ja: "大寒", ko: "대한" } },
  { key: "solar-lichun", date: "02-04", emoji: "🌱", name: { zh: "立春", en: "Start of Spring", ja: "立春", ko: "입춘" } },
  { key: "solar-yushui", date: "02-19", emoji: "💧", name: { zh: "雨水", en: "Rain Water", ja: "雨水", ko: "우수" } },
  { key: "solar-jingzhe", date: "03-06", emoji: "🐛", name: { zh: "惊蛰", en: "Awakening of Insects", ja: "啓蟄", ko: "경칩" } },
  { key: "solar-chunfen", date: "03-21", emoji: "🌸", name: { zh: "春分", en: "Spring Equinox", ja: "春分", ko: "춘분" } },
  { key: "solar-qingming", date: "04-05", emoji: "🍃", name: { zh: "清明", en: "Fresh Green", ja: "清明", ko: "청명" } },
  { key: "solar-guyu", date: "04-20", emoji: "🌾", name: { zh: "谷雨", en: "Grain Rain", ja: "穀雨", ko: "곡우" } },
  { key: "solar-lixia", date: "05-06", emoji: "☀️", name: { zh: "立夏", en: "Start of Summer", ja: "立夏", ko: "입하" } },
  { key: "solar-xiaoman", date: "05-21", emoji: "🌾", name: { zh: "小满", en: "Grain Buds", ja: "小満", ko: "소만" } },
  { key: "solar-mangzhong", date: "06-06", emoji: "🌾", name: { zh: "芒种", en: "Grain in Ear", ja: "芒種", ko: "망종" } },
  { key: "solar-xiazhi", date: "06-21", emoji: "🌻", name: { zh: "夏至", en: "Summer Solstice", ja: "夏至", ko: "하지" } },
  { key: "solar-xiaoshu", date: "07-07", emoji: "🌊", name: { zh: "小暑", en: "Minor Heat", ja: "小暑", ko: "소서" } },
  { key: "solar-dashu", date: "07-23", emoji: "🔥", name: { zh: "大暑", en: "Major Heat", ja: "大暑", ko: "대서" } },
  { key: "solar-liqiu", date: "08-08", emoji: "🍂", name: { zh: "立秋", en: "Start of Autumn", ja: "立秋", ko: "입추" } },
  { key: "solar-chushu", date: "08-23", emoji: "🌾", name: { zh: "处暑", en: "End of Heat", ja: "処暑", ko: "처서" } },
  { key: "solar-bailu", date: "09-08", emoji: "🌫️", name: { zh: "白露", en: "White Dew", ja: "白露", ko: "백로" } },
  { key: "solar-qiufen", date: "09-23", emoji: "🌗", name: { zh: "秋分", en: "Autumn Equinox", ja: "秋分", ko: "추분" } },
  { key: "solar-hanlu", date: "10-08", emoji: "🍁", name: { zh: "寒露", en: "Cold Dew", ja: "寒露", ko: "한로" } },
  { key: "solar-shuangjiang", date: "10-23", emoji: "❄️", name: { zh: "霜降", en: "First Frost", ja: "霜降", ko: "상강" } },
  { key: "solar-lidong", date: "11-07", emoji: "🧥", name: { zh: "立冬", en: "Start of Winter", ja: "立冬", ko: "입동" } },
  { key: "solar-xiaoxue", date: "11-22", emoji: "🌨️", name: { zh: "小雪", en: "Light Snow", ja: "小雪", ko: "소설" } },
  { key: "solar-daxue", date: "12-07", emoji: "⛄", name: { zh: "大雪", en: "Heavy Snow", ja: "大雪", ko: "대설" } },
  { key: "solar-dongzhi", date: "12-22", emoji: "🥟", name: { zh: "冬至", en: "Winter Solstice", ja: "冬至", ko: "동지" } },
];

/** 农历节日 2026-2030（写死;2031 后需续表,过期自动跳过不发瓶） */
const LUNAR: FestivalDef[] = [
  // 2026
  { key: "lunar-spring-2026", date: "2026-02-17", emoji: "🧨", name: { zh: "春节", en: "Spring Festival", ja: "春節", ko: "설날" } },
  { key: "lunar-lantern-2026", date: "2026-03-03", emoji: "🏮", name: { zh: "元宵", en: "Lantern Festival", ja: "元宵節", ko: "정월대보름" } },
  { key: "lunar-dragonboat-2026", date: "2026-06-19", emoji: "🐉", name: { zh: "端午", en: "Dragon Boat Festival", ja: "端午節", ko: "단오" } },
  { key: "lunar-qixi-2026", date: "2026-08-19", emoji: "🎋", name: { zh: "七夕", en: "Qixi Festival", ja: "七夕", ko: "칠석" } },
  { key: "lunar-moon-2026", date: "2026-09-25", emoji: "🌕", name: { zh: "中秋", en: "Mid-Autumn Festival", ja: "中秋節", ko: "추석" } },
  { key: "lunar-double9-2026", date: "2026-10-18", emoji: "⛰️", name: { zh: "重阳", en: "Double Ninth Festival", ja: "重陽節", ko: "중양절" } },
  // 2027
  { key: "lunar-spring-2027", date: "2027-02-06", emoji: "🧨", name: { zh: "春节", en: "Spring Festival", ja: "春節", ko: "설날" } },
  { key: "lunar-lantern-2027", date: "2027-02-20", emoji: "🏮", name: { zh: "元宵", en: "Lantern Festival", ja: "元宵節", ko: "정월대보름" } },
  { key: "lunar-dragonboat-2027", date: "2027-06-09", emoji: "🐉", name: { zh: "端午", en: "Dragon Boat Festival", ja: "端午節", ko: "단오" } },
  { key: "lunar-qixi-2027", date: "2027-08-08", emoji: "🎋", name: { zh: "七夕", en: "Qixi Festival", ja: "七夕", ko: "칠석" } },
  { key: "lunar-moon-2027", date: "2027-09-15", emoji: "🌕", name: { zh: "中秋", en: "Mid-Autumn Festival", ja: "中秋節", ko: "추석" } },
  { key: "lunar-double9-2027", date: "2027-10-08", emoji: "⛰️", name: { zh: "重阳", en: "Double Ninth Festival", ja: "重陽節", ko: "중양절" } },
  // 2028
  { key: "lunar-spring-2028", date: "2028-01-26", emoji: "🧨", name: { zh: "春节", en: "Spring Festival", ja: "春節", ko: "설날" } },
  { key: "lunar-lantern-2028", date: "2028-02-09", emoji: "🏮", name: { zh: "元宵", en: "Lantern Festival", ja: "元宵節", ko: "정월대보름" } },
  { key: "lunar-dragonboat-2028", date: "2028-05-28", emoji: "🐉", name: { zh: "端午", en: "Dragon Boat Festival", ja: "端午節", ko: "단오" } },
  { key: "lunar-qixi-2028", date: "2028-08-26", emoji: "🎋", name: { zh: "七夕", en: "Qixi Festival", ja: "七夕", ko: "칠석" } },
  { key: "lunar-moon-2028", date: "2028-10-03", emoji: "🌕", name: { zh: "中秋", en: "Mid-Autumn Festival", ja: "中秋節", ko: "추석" } },
  { key: "lunar-double9-2028", date: "2028-10-26", emoji: "⛰️", name: { zh: "重阳", en: "Double Ninth Festival", ja: "重陽節", ko: "중양절" } },
  // 2029
  { key: "lunar-spring-2029", date: "2029-02-13", emoji: "🧨", name: { zh: "春节", en: "Spring Festival", ja: "春節", ko: "설날" } },
  { key: "lunar-lantern-2029", date: "2029-02-27", emoji: "🏮", name: { zh: "元宵", en: "Lantern Festival", ja: "元宵節", ko: "정월대보름" } },
  { key: "lunar-dragonboat-2029", date: "2029-06-16", emoji: "🐉", name: { zh: "端午", en: "Dragon Boat Festival", ja: "端午節", ko: "단오" } },
  { key: "lunar-qixi-2029", date: "2029-08-15", emoji: "🎋", name: { zh: "七夕", en: "Qixi Festival", ja: "七夕", ko: "칠석" } },
  { key: "lunar-moon-2029", date: "2029-09-22", emoji: "🌕", name: { zh: "中秋", en: "Mid-Autumn Festival", ja: "中秋節", ko: "추석" } },
  { key: "lunar-double9-2029", date: "2029-10-16", emoji: "⛰️", name: { zh: "重阳", en: "Double Ninth Festival", ja: "重陽節", ko: "중양절" } },
  // 2030
  { key: "lunar-spring-2030", date: "2030-02-03", emoji: "🧨", name: { zh: "春节", en: "Spring Festival", ja: "春節", ko: "설날" } },
  { key: "lunar-lantern-2030", date: "2030-02-17", emoji: "🏮", name: { zh: "元宵", en: "Lantern Festival", ja: "元宵節", ko: "정월대보름" } },
  { key: "lunar-dragonboat-2030", date: "2030-06-05", emoji: "🐉", name: { zh: "端午", en: "Dragon Boat Festival", ja: "端午節", ko: "단오" } },
  { key: "lunar-qixi-2030", date: "2030-08-04", emoji: "🎋", name: { zh: "七夕", en: "Qixi Festival", ja: "七夕", ko: "칠석" } },
  { key: "lunar-moon-2030", date: "2030-09-12", emoji: "🌕", name: { zh: "中秋", en: "Mid-Autumn Festival", ja: "中秋節", ko: "추석" } },
  { key: "lunar-double9-2030", date: "2030-10-05", emoji: "⛰️", name: { zh: "重阳", en: "Double Ninth Festival", ja: "重陽節", ko: "중양절" } },
];

export const FESTIVALS = [...LUNAR, ...SOLAR_TERMS];

const LUNAR_MAP = new Map(LUNAR.map((f) => [f.date, f]));
const TERM_MAP = new Map(SOLAR_TERMS.map((f) => [f.date, f]));
const BY_KEY = new Map(FESTIVALS.map((f) => [f.key, f]));

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 这一天是节气或农历节日吗？（农历优先;按服务器本地日期） */
export function festivalOf(date: Date): FestivalDef | null {
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return LUNAR_MAP.get(date.toISOString().slice(0, 10)) ?? TERM_MAP.get(md) ?? null;
}

/** 按 key 反查（客户端解析瓶子的节日名） */
export function festivalByKey(key: string): FestivalDef | null {
  return BY_KEY.get(key) ?? null;
}
