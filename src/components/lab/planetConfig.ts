/* ============ 行星配置：真实太阳系 8 大行星 ============
 *
 * 数量与顺序对齐真实太阳系：水星→金星→地球→火星（岩质内圈），
 * 木星→土星→天王星→海王星（气态外圈）。
 * 小行星带落在火星与木星之间，与真实位置一致。
 *
 * 内容语义仍然挂在三个维度上（见《行星体系设计说明》）：
 *   轨道半径 = 内容的亲疏温度（内圈私人高频，外圈沉淀元信息）
 *   行星大小 = 内容体量
 *   大气配色 = 情绪温度
 * 但公转周期改为遵循真实开普勒比例 —— 既然是真实太阳系，就让它真的 obey Kepler。
 *
 * 数值是"压缩"过的，不是真实比例，否则外圈会被推出视野、木星会吞掉内圈：
 *   轨道  = log(轨道半长轴 AU) 线性映射到 62–372
 *   半径  = R^0.30 压缩，再归一化到地球 = 11
 *   自转  保留真实快慢顺序与逆行方向（金星、天王星为负），整体提速到肉眼可辨
 *   倾角  取各行星真实值（天王星 97.77° 侧躺，所以它的环是竖着的）
 */

import type { LText } from "@/lib/i18n/config";

export interface MomentItem {
  id: number;
  content: string;
  mood: string;
  date: string;
}

export interface StarItem {
  id: number;
  content: string;
  date: string;
}

export interface PlanetCounts {
  notes: number;
  posts: number;
  sound: number;
}

export type PlanetId =
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

export interface PlanetDef {
  id: PlanetId;
  /** 距日顺序 1–8，用于显示罗马数字 */
  order: number;
  /** 真实行星名（多语） */
  name: LText;
  /** 内容栏目名（主标签，多语） */
  label: LText;
  sub: LText;
  href: string | null;
  orbit: number;
  r: number;
  tone: ToneKey;
  /** 公转周期（秒），按真实比例压缩 */
  period: number;
  /** 初始相位（弧度） */
  phase: number;
  /** 轨道倾角（度），真实值 */
  incl: number;
  ring?: boolean;
}

export const PLANETS: PlanetDef[] = [
  {
    id: "mercury", order: 1,
    name: { zh: "水星", en: "Mercury", ja: "水星", ko: "수성" },
    label: { zh: "说说", en: "Moments", ja: "つぶやき", ko: "모먼트" },
    sub: { zh: "正在想的", en: "What's on my mind", ja: "いま考えていること", ko: "지금 떠오른 생각" },
    href: "/moments",
    orbit: 62, r: 8.2, tone: "warm", period: 22, phase: 0.6, incl: 7.0,
  },
  {
    id: "venus", order: 2,
    name: { zh: "金星", en: "Venus", ja: "金星", ko: "금성" },
    label: { zh: "相册", en: "Albums", ja: "アルバム", ko: "앨범" },
    sub: { zh: "光影暂存", en: "Light & shadow stash", ja: "光と影のストック", ko: "빛과 그림자 보관함" },
    href: "/albums",
    orbit: 100, r: 10.8, tone: "warm", period: 31, phase: 2.2, incl: 3.4,
  },
  {
    id: "earth", order: 3,
    name: { zh: "地球", en: "Earth", ja: "地球", ko: "지구" },
    label: { zh: "文章", en: "Posts", ja: "記事", ko: "글" },
    sub: { zh: "主力产出", en: "Main output", ja: "メインのアウトプット", ko: "메인 아웃풋" },
    href: "/posts",
    orbit: 122, r: 11, tone: "neutral", period: 38, phase: 4.1, incl: 0,
  },
  {
    id: "mars", order: 4,
    name: { zh: "火星", en: "Mars", ja: "火星", ko: "화성" },
    label: { zh: "回忆", en: "Memories", ja: "思い出", ko: "추억" },
    sub: { zh: "回忆瓶", en: "Memory bottle", ja: "思い出ボトル", ko: "추억 병" },
    href: null,
    orbit: 148, r: 9.1, tone: "warm", period: 46, phase: 5.6, incl: 1.85,
  },
  // 小行星带 170–193：访客留声星（真实太阳系里就在火星与木星之间）
  {
    id: "jupiter", order: 5,
    name: { zh: "木星", en: "Jupiter", ja: "木星", ko: "목성" },
    label: { zh: "项目", en: "Projects", ja: "プロジェクト", ko: "프로젝트" },
    sub: { zh: "作品集", en: "Portfolio", ja: "作品集", ko: "작품집" },
    href: "https://github.com/yyuu23",
    orbit: 224, r: 21, tone: "cool", period: 72, phase: 1.2, incl: 1.3,
  },
  {
    id: "saturn", order: 6,
    name: { zh: "土星", en: "Saturn", ja: "土星", ko: "토성" },
    label: { zh: "关于", en: "About", ja: "about", ko: "소개" },
    sub: { zh: "时间线", en: "Timeline", ja: "タイムライン", ko: "타임라인" },
    href: "/about",
    orbit: 262, r: 20, tone: "cool", period: 96, phase: 3.3, incl: 2.49, ring: true,
  },
  {
    id: "uranus", order: 7,
    name: { zh: "天王星", en: "Uranus", ja: "天王星", ko: "천왕성" },
    label: { zh: "音乐", en: "Music", ja: "ミュージック", ko: "음악" },
    sub: { zh: "留声屋", en: "Sound house", ja: "蓄音室", ko: "축음기 방" },
    href: "/music",
    orbit: 320, r: 16.6, tone: "cold", period: 140, phase: 0.4, incl: 0.77, ring: true,
  },
  {
    id: "neptune", order: 8,
    name: { zh: "海王星", en: "Neptune", ja: "海王星", ko: "해왕성" },
    label: { zh: "归档", en: "Archive", ja: "アーカイブ", ko: "아카이브" },
    sub: { zh: "时间沉淀", en: "Sediment of time", ja: "時間の堆積", ko: "시간의 퇴적물" },
    href: "/archive",
    orbit: 372, r: 16.5, tone: "cold", period: 200, phase: 2.8, incl: 1.77,
  },
];

/** 小行星带（访客留声星）的内外半径 —— 夹在火星(148)与木星(224)之间 */
export const BELT = { inner: 170, outer: 193, spread: 7 };

export type ToneKey = "warm" | "neutral" | "cool" | "cold";
export const TONE: Record<ToneKey, { fill: string; glow: string; label: LText }> = {
  warm: {
    fill: "#BA7517", glow: "#FAC775",
    label: { zh: "暖 · 个人 · 高频", en: "Warm · Personal · Frequent", ja: "暖かい · 個人 · 高頻度", ko: "따뜻함 · 개인 · 자주" },
  },
  neutral: {
    fill: "#378ADD", glow: "#85B7EB",
    label: { zh: "中性 · 主力产出", en: "Neutral · Main output", ja: "中立 · メイン産出", ko: "중립 · 메인 아웃풋" },
  },
  cool: {
    fill: "#534AB7", glow: "#AFA9EC",
    label: { zh: "冷 · 沉淀 · 专业", en: "Cool · Curated · Professional", ja: "クール · 蓄積 · 専門的", ko: "차분함 · 선별 · 전문" },
  },
  cold: {
    fill: "#5F5E5A", glow: "#B4B2A9",
    label: { zh: "最冷 · 元信息 · 归档", en: "Coldest · Meta · Archive", ja: "最も冷たい · メタ情報 · アーカイブ", ko: "가장 차가움 · 메타 · 아카이브" },
  },
};

/** 罗马数字，给行星标签用 */
export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/** 确定性伪随机 */
export function hash01(seed: number, salt: number) {
  const x = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ============ 真实模式：贴图与物理参数 ============
 * 贴图来自 three.js 官方 examples（NASA 公共领域数据）
 * 与 threex.planets（Planet Pixel Emporium，免费使用需署名）
 * 详见 public/textures/planets/CREDITS.md
 *
 * spin  = 自转角速度（rad/s）。保留真实快慢顺序与逆行方向（金星、天王星为负），
 *         但整体放大到肉眼可辨 —— 真实的水星自转周期是 58.6 天，照搬会像静止。
 * axial = 自转轴倾角（rad），取各行星真实值。
 *         金星写成 2.64° 而不是 177.4°：逆行已经由负的 spin 表达，再翻一次会抵消。
 */
export interface PlanetTex {
  map: string;
  normal?: string;
  /** 夜面灯光图 —— 只在背光半球发光（城市灯光） */
  night?: string;
  /** 云层图，独立自转，略快于地表 */
  clouds?: string;
  ring?: string;
  ringAlpha?: string;
  /** 环的内外径倍数（相对行星半径） */
  ringInner?: number;
  ringOuter?: number;
  /** 大气 Fresnel 边缘光颜色，null = 无大气 */
  atmo: string | null;
  atmoIntensity?: number;
  atmoPower?: number;
  spin: number;
  cloudSpin?: number;
  axial: number;
  rough: number;
}

export const TEX: Record<PlanetId, PlanetTex> = {
  // 水星：几乎无大气，表面布满撞击坑，自转最慢
  mercury: {
    map: "/textures/planets/mercury.jpg",
    atmo: null,
    spin: 0.045,
    axial: 0.0006,
    rough: 0.95,
  },
  // 金星：厚硫酸云，看不到地表，所以大气给得最厚、最亮
  venus: {
    map: "/textures/planets/venus.jpg",
    atmo: "#FFE0A8",
    atmoIntensity: 0.85,
    atmoPower: 2.4,
    spin: -0.06,
    axial: 0.046,
    rough: 0.86,
  },
  // 地球：日面 + 夜灯 + 云 + 法线，四层叠加
  earth: {
    map: "/textures/planets/earth_day.jpg",
    normal: "/textures/planets/earth_normal.jpg",
    night: "/textures/planets/earth_night.jpg",
    clouds: "/textures/planets/earth_clouds.png",
    atmo: "#7DD3FC",
    atmoIntensity: 1.15,
    atmoPower: 3.0,
    spin: 0.16,
    cloudSpin: 0.2,
    axial: 0.409,
    rough: 0.72,
  },
  // 火星：锈红暖调，稀薄大气
  mars: {
    map: "/textures/planets/mars.jpg",
    atmo: "#E9A878",
    atmoIntensity: 0.3,
    atmoPower: 3.4,
    spin: 0.155,
    axial: 0.4396,
    rough: 0.9,
  },
  // 木星：条纹 + 大红斑，自转最快
  jupiter: {
    map: "/textures/planets/jupiter.jpg",
    atmo: "#F0D9B5",
    atmoIntensity: 0.55,
    atmoPower: 3.2,
    spin: 0.34,
    axial: 0.0546,
    rough: 0.58,
  },
  // 土星：明亮的环，含卡西尼缝
  saturn: {
    map: "/textures/planets/saturn.jpg",
    ring: "/textures/planets/saturn_ring.jpg",
    ringAlpha: "/textures/planets/saturn_ring_alpha.png",
    ringInner: 1.38,
    ringOuter: 1.8,
    atmo: "#D9CBB0",
    atmoIntensity: 0.45,
    atmoPower: 3.4,
    spin: 0.3,
    axial: 0.4665,
    rough: 0.6,
  },
  // 天王星：自转轴几乎躺倒（97.77°），所以环是竖着的 —— 这是它最标志性的特征
  uranus: {
    map: "/textures/planets/uranus.jpg",
    ring: "/textures/planets/uranus_ring.jpg",
    ringAlpha: "/textures/planets/uranus_ring_alpha.png",
    ringInner: 1.4,
    ringOuter: 1.85,
    atmo: "#A8F0E8",
    atmoIntensity: 0.7,
    atmoPower: 3.0,
    spin: -0.22,
    axial: 1.7064,
    rough: 0.52,
  },
  // 海王星：最深的风速带，太阳系里最冷的一颗
  neptune: {
    map: "/textures/planets/neptune.jpg",
    atmo: "#6E9CFF",
    atmoIntensity: 0.85,
    atmoPower: 2.8,
    spin: 0.21,
    axial: 0.4942,
    rough: 0.6,
  },
};
