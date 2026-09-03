/** 访客游戏化：经验规则 + 等级 + 成就定义（服务端/客户端共用） */
import { DEFAULT_LOCALE, type Locale, type LText, pick } from "@/lib/i18n/config";
import { BASIC, READING, MUSIC, EXPLORE, SOCIAL, LEGEND } from "@/lib/achievements-data";

export interface PlayerStats {
  postsRead: number;
  readPostIds?: number[];
  songsPlayed: number;
  accentsTried: string[];
  eggFound: boolean;
  starsLeft: number;
  labVisits: number;
  chatUsed: number;
  /* --- 以下为长线 / 趣味成就补充 ---
   * stats 在库里是 JSON 列（visitors.stats），加字段不需要迁移。
   * nightVisits / dawnVisits / visitDays / streak 由服务端按时间推算，
   * 客户端不用管，所以这几个字段前端埋点里不会出现。 */
  themeToggles: number;
  searchUsed: number;
  calendarOpens: number;
  localesTried: string[];
  sunClicks: number;
  /** 点过恒星的次数 */
  planetClicks: number;
  planetIds?: string[];
  starViews: number;
  /** 0–5 点的访问次数 */
  nightVisits: number;
  /** 5–8 点的访问次数 */
  dawnVisits: number;
  /** 累计访问过的不同天数 */
  visitDays: number;
  /** 当前连续访问天数（暂无成就引用，留作未来用） */
  streak: number;
  /** 历史最长连续天数（暂无成就引用，留作未来用） */
  bestStreak: number;
}

export const EMPTY_STATS: PlayerStats = {
  postsRead: 0,
  readPostIds: [],
  songsPlayed: 0,
  accentsTried: [],
  eggFound: false,
  starsLeft: 0,
  labVisits: 0,
  chatUsed: 0,
  themeToggles: 0,
  searchUsed: 0,
  calendarOpens: 0,
  localesTried: [],
  sunClicks: 0,
  planetClicks: 0,
  planetIds: [],
  starViews: 0,
  nightVisits: 0,
  dawnVisits: 0,
  visitDays: 0,
  streak: 0,
  bestStreak: 0,
};

/** 各行为经验值（客户端即时展示与服务端结算共用） */
export const XP_RULES = {
  read_post: 10,
  play_music: 5,
  switch_accent: 5,
  find_egg: 30,
  leave_star: 15,
  visit_lab: 5,
  use_chat: 3,
  toggle_theme: 2,
  use_search: 2,
  open_calendar: 2,
  switch_locale: 4,
  poke_sun: 1,
  visit_planet: 2,
  view_star: 2,
} as const;

export type XpEvent = keyof typeof XP_RULES;

/** 每类事件的单日上限（防刷） */
export const DAILY_CAPS: Partial<Record<XpEvent, number>> = {
  read_post: 5,
  play_music: 3,
  switch_accent: 3,
  use_chat: 5,
  visit_lab: 1,
  leave_star: 3,
  toggle_theme: 3,
  use_search: 5,
  open_calendar: 3,
  switch_locale: 2,
  poke_sun: 5,
  visit_planet: 5,
  view_star: 5,
};

/** 旧库里没有新字段，读出来要补默认值，否则 check() 里访问 undefined 会炸 */
export function normalizeStats(raw: Partial<PlayerStats> | null | undefined): PlayerStats {
  return { ...EMPTY_STATS, ...(raw ?? {}) };
}

/** 等级曲线：累计经验所需（二次曲线放缓） */
export function levelOf(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const need = (lvl: number) => 40 * (lvl - 1) ** 2;
  const currentNeed = need(level);
  const nextNeed = need(level + 1);
  return {
    level,
    currentNeed,
    nextNeed,
    progress: Math.min(1, (xp - currentNeed) / Math.max(1, nextNeed - currentNeed)),
    tier: level >= 15 ? "gold" : level >= 8 ? "silver" : "bronze",
  };
}

export const LEVEL_TITLES: LText[] = [
  { zh: "初来乍到", en: "Newcomer", ja: "はじめまして", ko: "첫 방문" },
  { zh: "好奇访客", en: "Curious Visitor", ja: "好奇心のある訪問者", ko: "호기심 많은 방문자" },
  { zh: "常驻读者", en: "Regular Reader", ja: "常連読者", ko: "단골 독자" },
  { zh: "站点熟客", en: "Site Regular", ja: "サイトの常連", ko: "사이트 단골" },
  { zh: "探索者", en: "Explorer", ja: "探検者", ko: "탐험가" },
  { zh: "星空旅人", en: "Starry Traveler", ja: "星空の旅人", ko: "별하늘 여행자" },
  { zh: "摘星学徒", en: "Star-picker Apprentice", ja: "星摘み見習い", ko: "별따기 견습생" },
  { zh: "灵感收藏家", en: "Inspiration Collector", ja: "インスピレーション収集家", ko: "영감 수집가" },
  { zh: "实验室常客", en: "Lab Regular", ja: "ラボの常連", ko: "랩 단골" },
  { zh: "深空漫游者", en: "Deep Space Wanderer", ja: "深宇宙の放浪者", ko: "심우주 방랑자" },
  { zh: "星光缔造者", en: "Starlight Creator", ja: "星光の創造者", ko: "별빛 창조자" },
  { zh: "银河诗人", en: "Galactic Poet", ja: "銀河の詩人", ko: "은하 시인" },
  { zh: "传奇访客", en: "Legendary Visitor", ja: "伝説の訪問者", ko: "전설의 방문자" },
];

export function levelTitle(level: number, locale: Locale = DEFAULT_LOCALE) {
  const entry = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? LEVEL_TITLES[0]!;
  return pick(locale, entry);
}

/** 成就分组。数量一多就必须分组，否则成就墙是一堵没有结构的砖墙。 */
export type AchievementCategory = "basic" | "reading" | "music" | "explore" | "social" | "legend";

export const CATEGORY_META: Record<
  AchievementCategory,
  { emoji: string; name: LText; hint: LText }
> = {
  basic: {
    emoji: "🌱",
    name: { zh: "起步", en: "Getting Started", ja: "はじめの一歩", ko: "시작" },
    hint: { zh: "走进来就已经开始了", en: "Showing up is the first step", ja: "来たことが始まり", ko: "오는 것이 시작" },
  },
  reading: {
    emoji: "📖",
    name: { zh: "阅读", en: "Reading", ja: "読書", ko: "독서" },
    hint: { zh: "一篇一篇地读下去", en: "One post at a time", ja: "一記事ずつ読み進む", ko: "한 편씩 읽어가기" },
  },
  music: {
    emoji: "🎧",
    name: { zh: "聆听", en: "Listening", ja: "聴く", ko: "감상" },
    hint: { zh: "这里的歌会一直放", en: "The music keeps playing", ja: "ここ音楽はずっと流れている", ko: "이곳 음악은 계속 흐른다" },
  },
  explore: {
    emoji: "🧭",
    name: { zh: "探索", en: "Exploration", ja: "探索", ko: "탐험" },
    hint: { zh: "到处点点看", en: "Poke around", ja: "あちこち触ってみる", ko: "이곳저곳 눌러보기" },
  },
  social: {
    emoji: "✨",
    name: { zh: "交情", en: "Company", ja: "交流", ko: "교류" },
    hint: { zh: "留下点什么，或找人聊聊", en: "Leave something, or say hi", ja: "何か残す、あるいは話しかける", ko: "무언가 남기거나 인사하기" },
  },
  legend: {
    emoji: "🏆",
    name: { zh: "传说", en: "Legendary", ja: "伝説", ko: "전설" },
    hint: {
      zh: "理论上存在，实际上几乎没人拿到",
      en: "Theoretically obtainable, practically not",
      ja: "理論上は可能、実際はほぼ不可能",
      ko: "이론상 가능, 현실은 거의 불가",
    },
  },
};

export interface AchievementDef {
  key: string;
  name: LText;
  description: LText;
  emoji: string;
  category: AchievementCategory;
  /** 满足条件（基于 stats） */
  check: (s: PlayerStats) => boolean;
  /** 进度展示（仅未解锁时用）；数组字段自动取 length。复合条件成就可省略 */
  progress?: { stat: keyof PlayerStats; target: number };
}

/** UI 用：返回 { current, target } 或 null（无声明 / 无 stats） */
export function achievementProgress(a: AchievementDef, s: PlayerStats | undefined) {
  if (!a.progress || !s) return null;
  const raw = s[a.progress.stat];
  const current = Array.isArray(raw) ? raw.length : typeof raw === "boolean" ? 0 : Number(raw) || 0;
  return { current: Math.min(current, a.progress.target), target: a.progress.target };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  ...BASIC,
  ...READING,
  ...MUSIC,
  ...EXPLORE,
  ...SOCIAL,
  ...LEGEND,
];

export function unlockedAchievements(stats: PlayerStats) {
  return ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => a.key);
}
