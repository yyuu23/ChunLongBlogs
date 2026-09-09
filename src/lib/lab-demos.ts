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
];

export const LAB_DEMO_COUNT = LAB_DEMOS.length;

export function labDemoBySlug(slug: string): LabDemoDef | null {
  return LAB_DEMOS.find((d) => d.slug === slug) ?? null;
}
