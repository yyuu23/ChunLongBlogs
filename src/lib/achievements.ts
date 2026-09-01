/** 访客游戏化：经验规则 + 等级 + 成就定义（服务端/客户端共用） */
import { DEFAULT_LOCALE, type Locale, type LText, pick } from "@/lib/i18n/config";

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

export interface AchievementDef {
  key: string;
  name: LText;
  description: LText;
  emoji: string;
  /** 满足条件（基于 stats） */
  check: (s: PlayerStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "first_visit",
    name: { zh: "初次来访", en: "First Visit", ja: "初めての訪問", ko: "첫 방문" },
    description: { zh: "第一次踏进这个小站", en: "Step into this little site for the first time", ja: "この小さなサイトに初めて足を踏み入れる", ko: "이 작은 사이트에 처음 발을 들이다" },
    emoji: "🚪", check: () => true,
  },
  {
    key: "reader_1",
    name: { zh: "开卷有益", en: "Bookworm Begins", ja: "読書の始まり", ko: "독서의 시작" },
    description: { zh: "读完第一篇文章", en: "Finish your first post", ja: "最初の記事を読み終える", ko: "첫 글을 끝까지 읽기" },
    emoji: "📖", check: (s) => s.postsRead >= 1,
  },
  {
    key: "reader_5",
    name: { zh: "博览群书", en: "Well-read", ja: "博覧強記", ko: "박식한 독자" },
    description: { zh: "读完 5 篇文章", en: "Finish 5 posts", ja: "記事を 5 本読み終える", ko: "글 5편 읽기" },
    emoji: "📚", check: (s) => s.postsRead >= 5,
  },
  {
    key: "reader_10",
    name: { zh: "书房常客", en: "Library Regular", ja: "書斎の常連", ko: "서재 단골" },
    description: { zh: "读完 10 篇文章", en: "Finish 10 posts", ja: "記事を 10 本読み終える", ko: "글 10편 읽기" },
    emoji: "🏛️", check: (s) => s.postsRead >= 10,
  },
  {
    key: "music_1",
    name: { zh: "侧耳倾听", en: "First Listen", ja: "初めての一枚", ko: "첫 감상" },
    description: { zh: "在站点听第一首歌", en: "Play your first song on the site", ja: "サイトで初めて曲を聴く", ko: "사이트에서 첫 곡 듣기" },
    emoji: "🎧", check: (s) => s.songsPlayed >= 1,
  },
  {
    key: "music_5",
    name: { zh: "循环播放", en: "On Repeat", ja: "リピート再生", ko: "반복 재생" },
    description: { zh: "听歌 5 次", en: "Play songs 5 times", ja: "5 回曲を聴く", ko: "5곡 듣기" },
    emoji: "🎵", check: (s) => s.songsPlayed >= 5,
  },
  {
    key: "accent_2",
    name: { zh: "换装爱好者", en: "Style Switcher", ja: "着せ替え好き", ko: "코디 좋아" },
    description: { zh: "尝试 2 种主题色", en: "Try 2 accent colors", ja: "テーマカラーを 2 種類試す", ko: "테마 색 2가지 써보기" },
    emoji: "🎨", check: (s) => s.accentsTried.length >= 2,
  },
  {
    key: "accent_all",
    name: { zh: "色彩收藏家", en: "Color Collector", ja: "カラー収集家", ko: "색깔 수집가" },
    description: { zh: "集齐全部 5 种主题色", en: "Collect all 5 accent colors", ja: "全 5 種のテーマカラーをコンプリート", ko: "5가지 테마 색 모두 모으기" },
    emoji: "🌈", check: (s) => s.accentsTried.length >= 5,
  },
  {
    key: "egg",
    name: { zh: "彩蛋猎人", en: "Egg Hunter", ja: "エッグハンター", ko: "이스터에그 헌터" },
    description: { zh: "发现 Logo 的秘密", en: "Discover the Logo's secret", ja: "ロゴの秘密を見つける", ko: "로고의 비밀을 발견하기" },
    emoji: "🥚", check: (s) => s.eggFound,
  },
  {
    key: "star_1",
    name: { zh: "摘星人", en: "Star Picker", ja: "星摘み人", ko: "별따기" },
    description: { zh: "在夜空留下第一颗星", en: "Leave your first star in the night sky", ja: "夜空に最初の星を残す", ko: "밤하늘에 첫 별 남기기" },
    emoji: "⭐", check: (s) => s.starsLeft >= 1,
  },
  {
    key: "star_3",
    name: { zh: "满天星愿", en: "Wishing Stars", ja: "満天の星願い", ko: "가득한 소원별" },
    description: { zh: "留下 3 颗星", en: "Leave 3 stars", ja: "星を 3 つ残す", ko: "별 3개 남기기" },
    emoji: "🌟", check: (s) => s.starsLeft >= 3,
  },
  {
    key: "lab_1",
    name: { zh: "初次实验", en: "First Experiment", ja: "初めての実験", ko: "첫 실험" },
    description: { zh: "走进实验室", en: "Enter the Lab", ja: "ラボに入る", ko: "랩에 들어가기" },
    emoji: "🔬", check: (s) => s.labVisits >= 1,
  },
  {
    key: "chat_1",
    name: { zh: "破冰对话", en: "Icebreaker", ja: "アイスブレイク", ko: "첫 대화" },
    description: { zh: "和小助手聊上天", en: "Chat with the assistant", ja: "アシスタントと会話する", ko: "어시스턴트와 대화하기" },
    emoji: "💬", check: (s) => s.chatUsed >= 1,
  },
  {
    key: "chat_10",
    name: { zh: "话痨之友", en: "Chatterbox's Friend", ja: "おしゃべりの友", ko: "수다 친구" },
    description: { zh: "与小助手对话 10 次", en: "Chat with the assistant 10 times", ja: "アシスタントと 10 回会話する", ko: "어시스턴트와 10번 대화하기" },
    emoji: "🗣️", check: (s) => s.chatUsed >= 10,
  },
];

export function unlockedAchievements(stats: PlayerStats) {
  return ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => a.key);
}
