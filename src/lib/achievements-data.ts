/* 成就定义（按分类拆分）
 *
 * 单独成文件的原因：条目多（50+），且每条要写 4 种语言，塞回 achievements.ts
 * 会让那个文件没法读。这里只放数据，规则与等级仍留在 achievements.ts。
 *
 * 用 `import type` 而不是普通 import：achievements.ts 会 import 本文件，
 * 若本文件再反向 import 它，运行时就成环了。type 在编译后被擦除，安全。
 *
 * 设计原则：
 *   1. 每条都有一个明确的「长线阶梯」——1 / 10 / 100 / 1000，让早期就有反馈，
 *      远端又有奔头
 *   2. legend 组是刻意做不到的，用来保证成就墙永远有「没点亮的位置」
 *   3. 名字优先取有意象的中文短语，emoji 跟名字呼应，不用清一色的奖杯
 */
import type { AchievementDef } from "@/lib/achievements";

/* ============================ 起步 ============================ */
export const BASIC: AchievementDef[] = [
  {
    key: "first_visit",
    name: { zh: "初次来访", en: "First Visit", ja: "初めての訪問", ko: "첫 방문" },
    description: { zh: "第一次踏进这个小站", en: "Step into this little site for the first time", ja: "この小さなサイトに初めて足を踏み入れる", ko: "이 작은 사이트에 처음 발을 들이다" },
    emoji: "🚪",
    category: "basic",
    check: () => true,
  },
  {
    key: "lab_1",
    name: { zh: "初次实验", en: "First Experiment", ja: "初めての実験", ko: "첫 실험" },
    description: { zh: "走进实验室", en: "Enter the Lab", ja: "ラボに入る", ko: "랩에 들어가기" },
    emoji: "🔬",
    category: "basic",
    check: (s) => s.labVisits >= 1,
    progress: { stat: "labVisits", target: 1 },
  },
  {
    key: "day_2",
    name: { zh: "回头客", en: "Coming Back", ja: "また来た", ko: "다시 온 손님" },
    description: { zh: "在两天里来过", en: "Visit on two different days", ja: "2 日に分けて訪れる", ko: "이틀에 걸쳐 방문하기" },
    emoji: "🔁",
    category: "basic",
    check: (s) => s.visitDays >= 2,
    progress: { stat: "visitDays", target: 2 },
  },
  {
    key: "day_7",
    name: { zh: "一周熟客", en: "A Week's Regular", ja: "一週間の常連", ko: "일주일 단골" },
    description: { zh: "累计七天来访", en: "Visit on seven different days", ja: "のべ 7 日訪れる", ko: "총 7일 방문하기" },
    emoji: "🗓️",
    category: "basic",
    check: (s) => s.visitDays >= 7,
    progress: { stat: "visitDays", target: 7 },
  },
  {
    key: "days_30",
    name: { zh: "三十日之约", en: "Thirty Days Together", ja: "三十日の約束", ko: "30일의 약속" },
    description: { zh: "累计来访 30 天", en: "Visit on 30 different days", ja: "のべ 30 日訪れる", ko: "총 30일 방문하기" },
    emoji: "🔥",
    category: "basic",
    check: (s) => s.visitDays >= 30,
    progress: { stat: "visitDays", target: 30 },
  },
  {
    key: "accent_2",
    name: { zh: "换装爱好者", en: "Style Switcher", ja: "着せ替え好き", ko: "코디 좋아" },
    description: { zh: "尝试 2 种主题色", en: "Try 2 accent colors", ja: "テーマカラーを 2 種類試す", ko: "테마 색 2가지 써보기" },
    emoji: "🎨",
    category: "basic",
    check: (s) => s.accentsTried.length >= 2,
    progress: { stat: "accentsTried", target: 2 },
  },
  {
    key: "theme_1",
    name: { zh: "昼夜之间", en: "Between Day and Night", ja: "昼と夜のあいだ", ko: "낮과 밤 사이" },
    description: { zh: "切换一次明暗主题", en: "Toggle the theme once", ja: "テーマを一度切り替える", ko: "테마를 한 번 바꾸기" },
    emoji: "🌗",
    category: "basic",
    check: (s) => s.themeToggles >= 1,
    progress: { stat: "themeToggles", target: 1 },
  },
];

/* ============================ 阅读 ============================
 * 长线主阶梯：1 → 3 → 5 → 10 → 25 → 50 → 100 → 250 → 500
 * 1000 篇放进 legend（目前全站只有个位数文章，那里才是真正够不到的地方）。
 */
export const READING: AchievementDef[] = [
  {
    key: "reader_1",
    name: { zh: "开卷有益", en: "Bookworm Begins", ja: "読書の始まり", ko: "독서의 시작" },
    description: { zh: "读完第一篇文章", en: "Finish your first post", ja: "最初の記事を読み終える", ko: "첫 글을 끝까지 읽기" },
    emoji: "📖",
    category: "reading",
    check: (s) => s.postsRead >= 1,
    progress: { stat: "postsRead", target: 1 },
  },
  {
    key: "reader_3",
    name: { zh: "小有收获", en: "A Good Haul", ja: "ちょっとした収穫", ko: "작은 수확" },
    description: { zh: "读完 3 篇文章", en: "Finish 3 posts", ja: "記事を 3 本読み終える", ko: "글 3편 읽기" },
    emoji: "📕",
    category: "reading",
    check: (s) => s.postsRead >= 3,
    progress: { stat: "postsRead", target: 3 },
  },
  {
    key: "reader_5",
    name: { zh: "博览群书", en: "Well-read", ja: "博覧強記", ko: "박식한 독자" },
    description: { zh: "读完 5 篇文章", en: "Finish 5 posts", ja: "記事を 5 本読み終える", ko: "글 5편 읽기" },
    emoji: "📚",
    category: "reading",
    check: (s) => s.postsRead >= 5,
    progress: { stat: "postsRead", target: 5 },
  },
  {
    key: "reader_10",
    name: { zh: "书房常客", en: "Library Regular", ja: "書斎の常連", ko: "서재 단골" },
    description: { zh: "读完 10 篇文章", en: "Finish 10 posts", ja: "記事を 10 本読み終える", ko: "글 10편 읽기" },
    emoji: "🏛️",
    category: "reading",
    check: (s) => s.postsRead >= 10,
    progress: { stat: "postsRead", target: 10 },
  },
  {
    key: "reader_25",
    name: { zh: "卷帙渐盈", en: "Shelves Filling Up", ja: "書架が満ちてくる", ko: "책장이 차오른다" },
    description: { zh: "读完 25 篇文章", en: "Finish 25 posts", ja: "記事を 25 本読み終える", ko: "글 25편 읽기" },
    emoji: "📜",
    category: "reading",
    check: (s) => s.postsRead >= 25,
    progress: { stat: "postsRead", target: 25 },
  },
  {
    key: "reader_50",
    name: { zh: "学海无涯", en: "Endless Sea of Learning", ja: "学びの海に涯なし", ko: "배움의 바다는 끝이 없다" },
    description: { zh: "读完 50 篇文章", en: "Finish 50 posts", ja: "記事を 50 本読み終える", ko: "글 50편 읽기" },
    emoji: "🗿",
    category: "reading",
    check: (s) => s.postsRead >= 50,
    progress: { stat: "postsRead", target: 50 },
  },
  {
    key: "reader_100",
    name: { zh: "百篇通达", en: "The Hundred", ja: "百篇を通ず", ko: "백 편 통달" },
    description: { zh: "读完 100 篇文章", en: "Finish 100 posts", ja: "記事を 100 本読み終える", ko: "글 100편 읽기" },
    emoji: "🎓",
    category: "reading",
    check: (s) => s.postsRead >= 100,
    progress: { stat: "postsRead", target: 100 },
  },
  {
    key: "reader_250",
    name: { zh: "汗牛充栋", en: "A Library's Worth", ja: "汗牛充棟", ko: "책이 집을 채우다" },
    description: { zh: "读完 250 篇文章", en: "Finish 250 posts", ja: "記事を 250 本読み終える", ko: "글 250편 읽기" },
    emoji: "🧠",
    category: "reading",
    check: (s) => s.postsRead >= 250,
    progress: { stat: "postsRead", target: 250 },
  },
  {
    key: "reader_500",
    name: { zh: "星河读者", en: "Galactic Reader", ja: "銀河の読書家", ko: "은하의 독자" },
    description: { zh: "读完 500 篇文章", en: "Finish 500 posts", ja: "記事を 500 本読み終える", ko: "글 500편 읽기" },
    emoji: "🌌",
    category: "reading",
    check: (s) => s.postsRead >= 500,
    progress: { stat: "postsRead", target: 500 },
  },
];

/* ============================ 聆听 ============================
 * 歌曲可重复播放，所以这一组比阅读组更容易推进，
 * 远端（1000 次）才放进 legend。
 */
export const MUSIC: AchievementDef[] = [
  {
    key: "music_1",
    name: { zh: "侧耳倾听", en: "First Listen", ja: "初めての一枚", ko: "첫 감상" },
    description: { zh: "在站点听第一首歌", en: "Play your first song on the site", ja: "サイトで初めて曲を聴く", ko: "사이트에서 첫 곡 듣기" },
    emoji: "🎧",
    category: "music",
    check: (s) => s.songsPlayed >= 1,
    progress: { stat: "songsPlayed", target: 1 },
  },
  {
    key: "music_5",
    name: { zh: "循环播放", en: "On Repeat", ja: "リピート再生", ko: "반복 재생" },
    description: { zh: "听歌 5 次", en: "Play songs 5 times", ja: "5 回曲を聴く", ko: "5곡 듣기" },
    emoji: "🎵",
    category: "music",
    check: (s) => s.songsPlayed >= 5,
    progress: { stat: "songsPlayed", target: 5 },
  },
  {
    key: "music_20",
    name: { zh: "私人电台", en: "Personal Radio", ja: "マイラジオ", ko: "나만의 라디오" },
    description: { zh: "听歌 20 次", en: "Play songs 20 times", ja: "20 回曲を聴く", ko: "20곡 듣기" },
    emoji: "🎶",
    category: "music",
    check: (s) => s.songsPlayed >= 20,
    progress: { stat: "songsPlayed", target: 20 },
  },
  {
    key: "music_50",
    name: { zh: "曲库常驻", en: "Chart Resident", ja: "選曲の常連", ko: "플레이리스트 단골" },
    description: { zh: "听歌 50 次", en: "Play songs 50 times", ja: "50 回曲を聴く", ko: "50곡 듣기" },
    emoji: "🎼",
    category: "music",
    check: (s) => s.songsPlayed >= 50,
    progress: { stat: "songsPlayed", target: 50 },
  },
  {
    key: "music_100",
    name: { zh: "百听不厌", en: "Never Tires", ja: "何度聴いても飽きない", ko: "백 번 들어도 안 질린다" },
    description: { zh: "听歌 100 次", en: "Play songs 100 times", ja: "100 回曲を聴く", ko: "100곡 듣기" },
    emoji: "🎤",
    category: "music",
    check: (s) => s.songsPlayed >= 100,
    progress: { stat: "songsPlayed", target: 100 },
  },
  {
    key: "music_night",
    name: { zh: "深夜电台", en: "Midnight Radio", ja: "深夜ラジオ", ko: "심야 라디오" },
    description: { zh: "在深夜（0–5 点）听过歌", en: "Play music between midnight and 5am", ja: "深夜（0〜5 時）に曲を聴く", ko: "심야(0~5시)에 음악 듣기" },
    emoji: "🌙",
    category: "music",
    check: (s) => s.songsPlayed >= 5 && s.nightVisits >= 1,
  },
];

/* ============================ 探索 ============================
 * 这一组负责「到处点点看」的趣味：搜索、日历、戳太阳、逛行星。
 */
export const EXPLORE: AchievementDef[] = [
  {
    key: "search_1",
    name: { zh: "寻迹者", en: "Tracker", ja: "跡を追う者", ko: "흔적을 쫓는 자" },
    description: { zh: "第一次使用搜索", en: "Use search for the first time", ja: "初めて検索を使う", ko: "처음으로 검색하기" },
    emoji: "🔍",
    category: "explore",
    check: (s) => s.searchUsed >= 1,
    progress: { stat: "searchUsed", target: 1 },
  },
  {
    key: "search_10",
    name: { zh: "顺藤摸瓜", en: "Follow the Thread", ja: "手繰り寄せる", ko: "실마리를 쫓다" },
    description: { zh: "搜索 10 次", en: "Search 10 times", ja: "10 回検索する", ko: "10번 검색하기" },
    emoji: "🕵️",
    category: "explore",
    check: (s) => s.searchUsed >= 10,
    progress: { stat: "searchUsed", target: 10 },
  },
  {
    key: "calendar_1",
    name: { zh: "时光一瞥", en: "A Glance at Time", ja: "時間を覗く", ko: "시간 엿보기" },
    description: { zh: "打开一次日历", en: "Open the calendar once", ja: "カレンダーを一度開く", ko: "달력을 한 번 열기" },
    emoji: "📅",
    category: "explore",
    check: (s) => s.calendarOpens >= 1,
    progress: { stat: "calendarOpens", target: 1 },
  },
  {
    key: "calendar_10",
    name: { zh: "时间旅行者", en: "Time Traveler", ja: "時間旅行者", ko: "시간 여행자" },
    description: { zh: "打开日历 10 次", en: "Open the calendar 10 times", ja: "カレンダーを 10 回開く", ko: "달력을 10번 열기" },
    emoji: "⏳",
    category: "explore",
    check: (s) => s.calendarOpens >= 10,
    progress: { stat: "calendarOpens", target: 10 },
  },
  {
    key: "sun_1",
    name: { zh: "初逐日", en: "Chasing the Sun", ja: "初めて日を追う", ko: "첫 태양 추격" },
    description: { zh: "戳一戳实验室里的恒星", en: "Poke the star in the Lab", ja: "ラボの恒星をつつく", ko: "랩의 항성을 눌러보다" },
    emoji: "☀️",
    category: "explore",
    check: (s) => s.sunClicks >= 1,
    progress: { stat: "sunClicks", target: 1 },
  },
  {
    key: "sun_50",
    name: { zh: "逐日者", en: "Sun Chaser", ja: "日を追う者", ko: "태양을 쫓는 자" },
    description: { zh: "戳恒星 50 次", en: "Poke the star 50 times", ja: "恒星を 50 回つつく", ko: "항성을 50번 누르기" },
    emoji: "🔆",
    category: "explore",
    check: (s) => s.sunClicks >= 50,
    progress: { stat: "sunClicks", target: 50 },
  },
  {
    key: "planet_1",
    name: { zh: "星际第一站", en: "First Port of Call", ja: "星間最初の寄港地", ko: "첫 번째 행성" },
    description: { zh: "点开第一颗行星", en: "Click your first planet", ja: "最初の惑星を開く", ko: "첫 행성을 열다" },
    emoji: "🪐",
    category: "explore",
    check: (s) => s.planetClicks >= 1,
    progress: { stat: "planetClicks", target: 1 },
  },
  {
    key: "planet_all",
    name: { zh: "八星巡礼", en: "Grand Tour", ja: "八星巡礼", ko: "팔행성 순례" },
    description: { zh: "八颗行星全部拜访过", en: "Visit all eight planets", ja: "八つの惑星をすべて訪れる", ko: "여덟 행성을 모두 방문하기" },
    emoji: "🌠",
    category: "explore",
    check: (s) => (s.planetIds ?? []).length >= 8,
    progress: { stat: "planetIds", target: 8 },
  },
  {
    key: "planet_50",
    name: { zh: "轨道老手", en: "Orbit Veteran", ja: "軌道のベテラン", ko: "궤도 베테랑" },
    description: { zh: "点开行星 50 次", en: "Click planets 50 times", ja: "惑星を 50 回開く", ko: "행성을 50번 열기" },
    emoji: "🚀",
    category: "explore",
    check: (s) => s.planetClicks >= 50,
    progress: { stat: "planetClicks", target: 50 },
  },
  {
    key: "accent_all",
    name: { zh: "色彩收藏家", en: "Color Collector", ja: "カラー収集家", ko: "색깔 수집가" },
    description: { zh: "集齐全部 5 种主题色", en: "Collect all 5 accent colors", ja: "全 5 種のテーマカラーをコンプリート", ko: "5가지 테마 색 모두 모으기" },
    emoji: "🌈",
    category: "explore",
    check: (s) => s.accentsTried.length >= 5,
    progress: { stat: "accentsTried", target: 5 },
  },
  {
    key: "locale_2",
    name: { zh: "双语者", en: "Bilingual", ja: "バイリンガル", ko: "두 언어" },
    description: { zh: "切换过 2 种语言", en: "Switch between 2 languages", ja: "2 言語を行き来する", ko: "2개 언어를 오가기" },
    emoji: "🗺️",
    category: "explore",
    check: (s) => s.localesTried.length >= 2,
    progress: { stat: "localesTried", target: 2 },
  },
  {
    key: "locale_all",
    name: { zh: "通晓四语", en: "Polyglot", ja: "四か国語を操る", ko: "네 언어에 통하다" },
    description: { zh: "四种语言都用过", en: "Try all four languages", ja: "四言語すべてを使う", ko: "네 언어를 모두 써보다" },
    emoji: "🌐",
    category: "explore",
    check: (s) => s.localesTried.length >= 4,
    progress: { stat: "localesTried", target: 4 },
  },
  {
    key: "theme_100",
    name: { zh: "昼夜颠倒", en: "Day for Night", ja: "昼夜逆転", ko: "주야 역전" },
    description: { zh: "切换明暗主题 100 次", en: "Toggle the theme 100 times", ja: "テーマを 100 回切り替える", ko: "테마를 100번 바꾸기" },
    emoji: "🌓",
    category: "explore",
    check: (s) => s.themeToggles >= 100,
    progress: { stat: "themeToggles", target: 100 },
  },
  {
    key: "egg",
    name: { zh: "彩蛋猎人", en: "Egg Hunter", ja: "エッグハンター", ko: "이스터에그 헌터" },
    description: { zh: "发现 Logo 的秘密", en: "Discover the Logo's secret", ja: "ロゴの秘密を見つける", ko: "로고의 비밀을 발견하기" },
    emoji: "🥚",
    category: "explore",
    check: (s) => s.eggFound,
  },
];

/* ============================ 交情 ============================ */
export const SOCIAL: AchievementDef[] = [
  {
    key: "star_1",
    name: { zh: "摘星人", en: "Star Picker", ja: "星摘み人", ko: "별따기" },
    description: { zh: "在夜空留下第一颗星", en: "Leave your first star in the night sky", ja: "夜空に最初の星を残す", ko: "밤하늘에 첫 별 남기기" },
    emoji: "⭐",
    category: "social",
    check: (s) => s.starsLeft >= 1,
    progress: { stat: "starsLeft", target: 1 },
  },
  {
    key: "star_3",
    name: { zh: "满天星愿", en: "Wishing Stars", ja: "満天の星願い", ko: "가득한 소원별" },
    description: { zh: "留下 3 颗星", en: "Leave 3 stars", ja: "星を 3 つ残す", ko: "별 3개 남기기" },
    emoji: "🌟",
    category: "social",
    check: (s) => s.starsLeft >= 3,
    progress: { stat: "starsLeft", target: 3 },
  },
  {
    key: "star_10",
    name: { zh: "星河信使", en: "Galaxy Courier", ja: "星河の使者", ko: "은하의 전령" },
    description: { zh: "留下 10 颗星", en: "Leave 10 stars", ja: "星を 10 個残す", ko: "별 10개 남기기" },
    emoji: "💫",
    category: "social",
    check: (s) => s.starsLeft >= 10,
    progress: { stat: "starsLeft", target: 10 },
  },
  {
    key: "starview_1",
    name: { zh: "读星人", en: "Star Reader", ja: "星を読む人", ko: "별을 읽는 사람" },
    description: { zh: "点开别人的留声星", en: "Read someone else's star", ja: "誰かの星を開いて読む", ko: "다른 사람의 별을 열어보기" },
    emoji: "👀",
    category: "social",
    check: (s) => s.starViews >= 1,
    progress: { stat: "starViews", target: 1 },
  },
  {
    key: "starview_20",
    name: { zh: "观星者", en: "Stargazer", ja: "星見る人", ko: "별을 보는 사람" },
    description: { zh: "读 20 颗别人的星", en: "Read 20 stars from others", ja: "誰かの星を 20 個読む", ko: "다른 사람의 별 20개 읽기" },
    emoji: "🔭",
    category: "social",
    check: (s) => s.starViews >= 20,
    progress: { stat: "starViews", target: 20 },
  },
  {
    key: "chat_1",
    name: { zh: "破冰对话", en: "Icebreaker", ja: "アイスブレイク", ko: "첫 대화" },
    description: { zh: "和小助手聊上天", en: "Chat with the assistant", ja: "アシスタントと会話する", ko: "어시스턴트와 대화하기" },
    emoji: "💬",
    category: "social",
    check: (s) => s.chatUsed >= 1,
    progress: { stat: "chatUsed", target: 1 },
  },
  {
    key: "chat_10",
    name: { zh: "话痨之友", en: "Chatterbox's Friend", ja: "おしゃべりの友", ko: "수다 친구" },
    description: { zh: "与小助手对话 10 次", en: "Chat with the assistant 10 times", ja: "アシスタントと 10 回会話する", ko: "어시스턴트와 10번 대화하기" },
    emoji: "🗣️",
    category: "social",
    check: (s) => s.chatUsed >= 10,
    progress: { stat: "chatUsed", target: 10 },
  },
  {
    key: "chat_100",
    name: { zh: "老朋友", en: "Old Friend", ja: "古い友人", ko: "오래된 친구" },
    description: { zh: "与小助手对话 100 次", en: "Chat with the assistant 100 times", ja: "アシスタントと 100 回会話する", ko: "어시스턴트와 100번 대화하기" },
    emoji: "🫂",
    category: "social",
    check: (s) => s.chatUsed >= 100,
    progress: { stat: "chatUsed", target: 100 },
  },
];

/* ============================ 传说 ============================
 * 刻意做成「理论上存在，实际上几乎拿不到」。
 * 成就墙需要永远留着几个点不亮的格子 —— 全部可完成的那天，
 * 这套系统的吸引力也就结束了。
 *
 * 注意：这里的阈值是相对站点现状定的。全站文章还是个位数时，
 * reader_1000 与文章的绝对数量绑定，站点成长后它才会从「不可能」
 * 变成「极难」，这本身就是长线激励的一部分。
 */
export const LEGEND: AchievementDef[] = [
  {
    key: "reader_1000",
    name: { zh: "千篇传说", en: "The Thousand", ja: "千篇の伝説", ko: "천 편의 전설" },
    description: { zh: "读完 1000 篇文章", en: "Finish 1000 posts", ja: "記事を 1000 本読み終える", ko: "글 1000편 읽기" },
    emoji: "🐉",
    category: "legend",
    check: (s) => s.postsRead >= 1000,
    progress: { stat: "postsRead", target: 1000 },
  },
  {
    key: "music_1000",
    name: { zh: "永不间断", en: "Never Stopping", ja: "決して途切れない", ko: "결코 멈추지 않는" },
    description: { zh: "听歌 1000 次", en: "Play songs 1000 times", ja: "1000 回曲を聴く", ko: "1000곡 듣기" },
    emoji: "🎛️",
    category: "legend",
    check: (s) => s.songsPlayed >= 1000,
    progress: { stat: "songsPlayed", target: 1000 },
  },
  {
    key: "days_365",
    name: { zh: "四季常在", en: "Through Every Season", ja: "四季を通して", ko: "사계절 내내" },
    description: { zh: "累计来访 365 天", en: "Visit on 365 different days", ja: "のべ 365 日訪れる", ko: "총 365일 방문하기" },
    emoji: "👑",
    category: "legend",
    check: (s) => s.visitDays >= 365,
    progress: { stat: "visitDays", target: 365 },
  },
  {
    key: "night_50",
    name: { zh: "夜之住民", en: "Citizen of the Night", ja: "夜の住人", ko: "밤의 주민" },
    description: { zh: "在 0–5 点来访 50 次", en: "Visit 50 times between midnight and 5am", ja: "0〜5 時に 50 回訪れる", ko: "0~5시에 50번 방문하기" },
    emoji: "🦉",
    category: "legend",
    check: (s) => s.nightVisits >= 50,
    progress: { stat: "nightVisits", target: 50 },
  },
  {
    key: "dawn_30",
    name: { zh: "晨曦常客", en: "Dawn Regular", ja: "明け方の常連", ko: "새벽 단골" },
    description: { zh: "在 5–8 点来访 30 次", en: "Visit 30 times between 5am and 8am", ja: "5〜8 時に 30 回訪れる", ko: "5~8시에 30번 방문하기" },
    emoji: "🐦",
    category: "legend",
    check: (s) => s.dawnVisits >= 30,
    progress: { stat: "dawnVisits", target: 30 },
  },
  {
    key: "lab_365",
    name: { zh: "实验室主人", en: "Master of the Lab", ja: "ラボの主", ko: "랩의 주인" },
    description: { zh: "走进实验室 365 次", en: "Enter the Lab 365 times", ja: "ラボに 365 回入る", ko: "랩에 365번 들어가기" },
    emoji: "🧪",
    category: "legend",
    check: (s) => s.labVisits >= 365,
    progress: { stat: "labVisits", target: 365 },
  },
  {
    key: "chat_1000",
    name: { zh: "滔滔不绝", en: "Never-ending Chat", ja: "尽きぬおしゃべり", ko: "끝없는 대화" },
    description: { zh: "与小助手对话 1000 次", en: "Chat with the assistant 1000 times", ja: "アシスタントと 1000 回会話する", ko: "어시스턴트와 1000번 대화하기" },
    emoji: "📞",
    category: "legend",
    check: (s) => s.chatUsed >= 1000,
    progress: { stat: "chatUsed", target: 1000 },
  },
  {
    key: "omni",
    name: { zh: "无所不为", en: "Jack of All Trades", ja: "何でも屋", ko: "못하는 게 없는" },
    description: {
      zh: "阅读、聆听、探索、交情四大类各解锁 5 个以上",
      en: "Unlock 5+ achievements in each of the four main categories",
      ja: "読書・聴く・探索・交流の四分類でそれぞれ 5 個以上解除",
      ko: "독서·감상·탐험·교류 네 분류에서 각각 5개 이상 해금",
    },
    emoji: "♾️",
    category: "legend",
    // 这个成就在 unlockedAchievements 里做二次判定，check 只给保守门槛
    check: (s) =>
      s.postsRead >= 5 &&
      s.songsPlayed >= 20 &&
      s.searchUsed >= 5 &&
      s.starsLeft >= 3 &&
      s.chatUsed >= 5,
  },
];
