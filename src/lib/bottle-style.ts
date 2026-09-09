/** 漂流瓶形态推导（纯函数，客户端/服务端共用，可测试）。
 *  瓶型/材质/瓶塞完全由已有的 kind + refKey + id 推导——不加列不迁移，
 *  老瓶子落库那一刻的"身份"天然决定它长什么样。图鉴见 docs/BOTTLE_SYSTEM.md。 */
import { ACHIEVEMENTS } from "@/lib/achievements";
import { festivalByKey, festivalParticleOf } from "@/lib/festivals";

export type BottleShape = "round" | "slim" | "gourd" | "square" | "star" | "roly" | "teardrop" | "lantern";
export type BottleMaterial = "glass" | "frosted" | "gilded" | "porcelain" | "nebula";
export type BottleCork = "cork" | "wax" | "star" | "ribbon";

export interface BottleStyle {
  shape: BottleShape;
  material: BottleMaterial;
  cork: BottleCork;
}

/** 瓶型图鉴清单（形态枚举；展示命名在组件层做） */
export const BOTTLE_SHAPE_LIST: BottleShape[] = [
  "round",
  "slim",
  "gourd",
  "square",
  "star",
  "roly",
  "teardrop",
  "lantern",
];

/** 农历节日 → 青花瓷专属瓶型（红绸带封口） */
const LUNAR_STYLE: Record<string, BottleShape> = {
  spring: "lantern", // 春节：灯笼瓶
  lantern: "lantern", // 元宵：灯笼瓶
  dragonboat: "gourd", // 端午：葫芦（配艾蒲菖蒲）
  qixi: "teardrop", // 七夕：泪滴
  moon: "round", // 中秋：圆月
  double9: "square", // 重阳：方樽
};

/** 成就稀有度（按成就分组）→ 瓶型/材质/瓶塞 */
const ACH_STYLE: Record<string, BottleStyle> = {
  basic: { shape: "round", material: "glass", cork: "cork" },
  reading: { shape: "slim", material: "glass", cork: "cork" },
  music: { shape: "gourd", material: "glass", cork: "cork" },
  explore: { shape: "teardrop", material: "frosted", cork: "cork" },
  social: { shape: "square", material: "glass", cork: "wax" },
  legend: { shape: "star", material: "nebula", cork: "star" }, // 传说：星形星空玻璃
};

/** 节气 → 按所属季节的两款瓶型交替（月份奇偶），磨砂玻璃 + 蜡封 */
const SOLAR_BY_SEASON: Record<string, [BottleShape, BottleShape]> = {
  sakura: ["slim", "teardrop"],
  firefly: ["round", "gourd"],
  leaf: ["square", "slim"],
  snow: ["roly", "gourd"],
};

function hashOf(n: number) {
  return (Math.imul(n, 2654435761) >>> 0) || 1;
}

/** 一只瓶子长什么样：kind 决定大方向，refKey 决定细节，id 给留星瓶稳定随机 */
export function bottleStyleOf(b: { kind: string; refKey: string; id?: number }): BottleStyle {
  // 跨年纪念瓶：星形鎏金 + 星形塞——一年一只的仪式感
  if (b.kind === "newyear") return { shape: "star", material: "gilded", cork: "star" };

  if (b.kind === "festival") {
    const stem = b.refKey.match(/^lunar-([a-z0-9]+)-\d{4}$/)?.[1];
    if (stem && LUNAR_STYLE[stem]) return { shape: LUNAR_STYLE[stem], material: "porcelain", cork: "ribbon" };
    const fest = festivalByKey(b.refKey);
    if (fest) {
      const pair = SOLAR_BY_SEASON[festivalParticleOf(fest)] ?? SOLAR_BY_SEASON.firefly!;
      const month = Number(fest.date.slice(0, 2));
      return { shape: pair[month % 2 === 1 ? 1 : 0]!, material: "frosted", cork: "wax" };
    }
    return { shape: "round", material: "frosted", cork: "wax" };
  }

  if (b.kind === "achievement") {
    const cat = ACHIEVEMENTS.find((a) => a.key === b.refKey)?.category ?? "basic";
    return ACH_STYLE[cat] ?? ACH_STYLE.basic!;
  }

  // 留星瓶：瓶型由 id 哈希稳定随机（同一只永远同款）；每 17 只出一支星空玻璃彩蛋
  const h = hashOf(b.id ?? 0);
  return {
    shape: BOTTLE_SHAPE_LIST[h % BOTTLE_SHAPE_LIST.length]!,
    material: h % 17 === 3 ? "nebula" : "glass",
    cork: "cork",
  };
}
