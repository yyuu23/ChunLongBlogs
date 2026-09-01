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
  /** 真实行星名 */
  name: string;
  en: string;
  /** 内容栏目名（主标签） */
  label: string;
  sub: string;
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
    id: "mercury", order: 1, name: "水星", en: "Mercury",
    label: "说说", sub: "正在想的", href: "/moments",
    orbit: 62, r: 8.2, tone: "warm", period: 22, phase: 0.6, incl: 7.0,
  },
  {
    id: "venus", order: 2, name: "金星", en: "Venus",
    label: "相册", sub: "光影暂存", href: "/albums",
    orbit: 100, r: 10.8, tone: "warm", period: 31, phase: 2.2, incl: 3.4,
  },
  {
    id: "earth", order: 3, name: "地球", en: "Earth",
    label: "文章", sub: "主力产出", href: "/posts",
    orbit: 122, r: 11, tone: "neutral", period: 38, phase: 4.1, incl: 0,
  },
  {
    id: "mars", order: 4, name: "火星", en: "Mars",
    label: "回忆", sub: "回忆瓶", href: null,
    orbit: 148, r: 9.1, tone: "warm", period: 46, phase: 5.6, incl: 1.85,
  },
  // 小行星带 170–193：访客留声星（真实太阳系里就在火星与木星之间）
  {
    id: "jupiter", order: 5, name: "木星", en: "Jupiter",
    label: "项目", sub: "作品集", href: "https://github.com/yyuu23",
    orbit: 224, r: 21, tone: "cool", period: 72, phase: 1.2, incl: 1.3,
  },
  {
    id: "saturn", order: 6, name: "土星", en: "Saturn",
    label: "关于", sub: "时间线", href: "/about",
    orbit: 262, r: 20, tone: "cool", period: 96, phase: 3.3, incl: 2.49, ring: true,
  },
  {
    id: "uranus", order: 7, name: "天王星", en: "Uranus",
    label: "音乐", sub: "留声屋", href: "/music",
    orbit: 320, r: 16.6, tone: "cold", period: 140, phase: 0.4, incl: 0.77, ring: true,
  },
  {
    id: "neptune", order: 8, name: "海王星", en: "Neptune",
    label: "归档", sub: "时间沉淀", href: "/archive",
    orbit: 372, r: 16.5, tone: "cold", period: 200, phase: 2.8, incl: 1.77,
  },
];

/** 小行星带（访客留声星）的内外半径 —— 夹在火星(148)与木星(224)之间 */
export const BELT = { inner: 170, outer: 193, spread: 7 };

export type ToneKey = "warm" | "neutral" | "cool" | "cold";
export const TONE: Record<ToneKey, { fill: string; glow: string; label: string }> = {
  warm: { fill: "#BA7517", glow: "#FAC775", label: "暖 · 个人 · 高频" },
  neutral: { fill: "#378ADD", glow: "#85B7EB", label: "中性 · 主力产出" },
  cool: { fill: "#534AB7", glow: "#AFA9EC", label: "冷 · 沉淀 · 专业" },
  cold: { fill: "#5F5E5A", glow: "#B4B2A9", label: "最冷 · 元信息 · 归档" },
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
