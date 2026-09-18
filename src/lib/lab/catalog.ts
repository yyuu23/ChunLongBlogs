/** 实验台 demo 注册表（纯数据，服务端/客户端共用——不 import 任何组件）。
 *  页面 metadata、sitemap、/lab 实验台卡片、demo_all 成就判定都读这份表；
 *  组件映射在 components/lab/demos/registry.tsx（next/dynamic 懒加载，
 *  demo 代码不进 /lab 主页 bundle）。新增一个实验 = 写组件 + 这里加一行。 */
import { type LText } from "@/lib/i18n/config";

export interface LabDemoDef {
  /** URL 段（/lab/<slug>） */
  slug: string;
  emoji: string;
  name: LText;
  desc: LText;
}

export const LAB_DEMOS: LabDemoDef[] = [
  {
    slug: "fireworks",
    emoji: "🎆",
    name: { zh: "烟花", en: "Fireworks", ja: "花火", ko: "불꽃놀이" },
    desc: {
      zh: "点一下夜空，放一朵自己的烟花",
      en: "Tap the night sky and launch your own firework",
      ja: "夜空をタップして、自分だけの花火を",
      ko: "밤하늘을 눌러 나만의 불꽃을 쏘아올리세요",
    },
  },
  {
    slug: "lanterns",
    emoji: "🏮",
    name: { zh: "孔明灯", en: "Sky Lanterns", ja: "天灯", ko: "풍등" },
    desc: {
      zh: "写一句愿望，放一盏灯缓缓升空",
      en: "Write a wish and release a lantern into the night",
      ja: "願いを書いて、灯籠をゆっくり夜空へ",
      ko: "소원을 적어 등불을 밤하늘로 띄워보세요",
    },
  },
  {
    slug: "text-spark",
    emoji: "✨",
    name: { zh: "粒子文字", en: "Text Spark", ja: "パーティクル文字", ko: "파티클 문자" },
    desc: {
      zh: "一句话聚成星光，再炸成烟花",
      en: "Watch your words gather into stardust, then burst like fireworks",
      ja: "言葉が星屑に集まり、やがて花火のように弾ける",
      ko: "문장이 별빛으로 모였다가 불꽃처럼 터져요",
    },
  },
  {
    slug: "fluid",
    emoji: "🌊",
    name: { zh: "流体", en: "Fluid", ja: "流体", ko: "유체" },
    desc: {
      zh: "指尖划过，搅动一池彩色烟雾",
      en: "Drag through a pool of colorful drifting smoke",
      ja: "指でなぞると、色の煙が渦を巻く",
      ko: "손끝을 그리면 색연기가 물결쳐요",
    },
  },
  {
    slug: "matrix",
    emoji: "🌐",
    name: { zh: "代码雨", en: "Code Rain", ja: "コードレイン", ko: "코드 레인" },
    desc: {
      zh: "黑客帝国风的字符雨，点一下泛起波纹",
      en: "Matrix-style glyph rain — tap to ripple",
      ja: "マトリックス風の文字雨、タップで波紋が広がる",
      ko: "매트릭스풍 문자 비, 누르면 물결이 번져요",
    },
  },
  {
    slug: "noise",
    emoji: "🎧",
    name: { zh: "白噪音机", en: "Noise Mixer", ja: "ノイズミキサー", ko: "노이즈 믹서" },
    desc: {
      zh: "雨声、篝火、海浪……叠加出你的专注背景音",
      en: "Rain, campfire, ocean waves — mix your focus ambience",
      ja: "雨、焚き火、波音……自分だけの集中BGMをミックス",
      ko: "빗소리, 모닥불, 파도… 나만의 집중 배경음을 믹스해요",
    },
  },
];

export const LAB_DEMO_COUNT = LAB_DEMOS.length;

export function labDemoBySlug(slug: string): LabDemoDef | null {
  return LAB_DEMOS.find((d) => d.slug === slug) ?? null;
}
