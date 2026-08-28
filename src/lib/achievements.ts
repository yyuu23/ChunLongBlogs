/** 访客游戏化：经验规则 + 等级 + 成就定义（服务端/客户端共用） */

export interface PlayerStats {
  postsRead: number;
  readPostIds?: number[];
  songsPlayed: number;
  accentsTried: string[];
  eggFound: boolean;
  starsLeft: number;
  labVisits: number;
  chatUsed: number;
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
};

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

export const LEVEL_TITLES = [
  "初来乍到", "好奇访客", "常驻读者", "站点熟客", "探索者",
  "星空旅人", "摘星学徒", "灵感收藏家", "实验室常客", "深空漫游者",
  "星光缔造者", "银河诗人", "传奇访客",
];

export function levelTitle(level: number) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? LEVEL_TITLES[0];
}

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  emoji: string;
  /** 满足条件（基于 stats） */
  check: (s: PlayerStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_visit", name: "初次来访", description: "第一次踏进这个小站", emoji: "🚪", check: () => true },
  { key: "reader_1", name: "开卷有益", description: "读完第一篇文章", emoji: "📖", check: (s) => s.postsRead >= 1 },
  { key: "reader_5", name: "博览群书", description: "读完 5 篇文章", emoji: "📚", check: (s) => s.postsRead >= 5 },
  { key: "reader_10", name: "书房常客", description: "读完 10 篇文章", emoji: "🏛️", check: (s) => s.postsRead >= 10 },
  { key: "music_1", name: "侧耳倾听", description: "在站点听第一首歌", emoji: "🎧", check: (s) => s.songsPlayed >= 1 },
  { key: "music_5", name: "循环播放", description: "听歌 5 次", emoji: "🎵", check: (s) => s.songsPlayed >= 5 },
  { key: "accent_2", name: "换装爱好者", description: "尝试 2 种主题色", emoji: "🎨", check: (s) => s.accentsTried.length >= 2 },
  { key: "accent_all", name: "色彩收藏家", description: "集齐全部 5 种主题色", emoji: "🌈", check: (s) => s.accentsTried.length >= 5 },
  { key: "egg", name: "彩蛋猎人", description: "发现 Logo 的秘密", emoji: "🥚", check: (s) => s.eggFound },
  { key: "star_1", name: "摘星人", description: "在夜空留下第一颗星", emoji: "⭐", check: (s) => s.starsLeft >= 1 },
  { key: "star_3", name: "满天星愿", description: "留下 3 颗星", emoji: "🌟", check: (s) => s.starsLeft >= 3 },
  { key: "lab_1", name: "初次实验", description: "走进实验室", emoji: "🔬", check: (s) => s.labVisits >= 1 },
  { key: "chat_1", name: "破冰对话", description: "和小助手聊上天", emoji: "💬", check: (s) => s.chatUsed >= 1 },
  { key: "chat_10", name: "话痨之友", description: "与小助手对话 10 次", emoji: "🗣️", check: (s) => s.chatUsed >= 10 },
];

export function unlockedAchievements(stats: PlayerStats) {
  return ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => a.key);
}
