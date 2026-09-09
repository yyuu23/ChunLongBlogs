import { describe, expect, it } from "vitest";
import { bottleStyleOf, BOTTLE_SHAPE_LIST } from "@/lib/bottle-style";

describe("bottleStyleOf：瓶型/材质/瓶塞推导", () => {
  it("跨年瓶：星形 + 鎏金 + 星形塞", () => {
    expect(bottleStyleOf({ kind: "newyear", refKey: "2026" })).toEqual({
      shape: "star",
      material: "gilded",
      cork: "star",
    });
  });

  it("农历节日：青花瓷 + 红绸带，各节日专属瓶型", () => {
    expect(bottleStyleOf({ kind: "festival", refKey: "lunar-spring-2026" })).toMatchObject({
      shape: "lantern",
      material: "porcelain",
      cork: "ribbon",
    });
    expect(bottleStyleOf({ kind: "festival", refKey: "lunar-moon-2026" })).toMatchObject({ shape: "round", cork: "ribbon" });
    expect(bottleStyleOf({ kind: "festival", refKey: "lunar-qixi-2027" })).toMatchObject({ shape: "teardrop" });
  });

  it("节气：磨砂 + 蜡封，瓶型按季节两款交替", () => {
    const dongzhi = bottleStyleOf({ kind: "festival", refKey: "solar-dongzhi" }); // 12 月 → snow → roly/gourd 偶数月取 roly
    expect(dongzhi).toMatchObject({ material: "frosted", cork: "wax" });
    expect(["roly", "gourd"]).toContain(dongzhi.shape);
    const chunfen = bottleStyleOf({ kind: "festival", refKey: "solar-chunfen" }); // 03 → sakura
    expect(["slim", "teardrop"]).toContain(chunfen.shape);
  });

  it("成就：按分组稀有度映射，legend 是星形星空玻璃", () => {
    expect(bottleStyleOf({ kind: "achievement", refKey: "first_visit" })).toMatchObject({
      shape: "round",
      material: "glass",
      cork: "cork",
    });
    expect(bottleStyleOf({ kind: "achievement", refKey: "reader_1000" })).toEqual({
      shape: "star",
      material: "nebula",
      cork: "star",
    });
  });

  it("留星瓶：同一只永远同款（哈希稳定），瓶型在图鉴 8 型之内", () => {
    const a = bottleStyleOf({ kind: "star", refKey: "123", id: 42 });
    const b = bottleStyleOf({ kind: "star", refKey: "123", id: 42 });
    expect(a).toEqual(b);
    expect(BOTTLE_SHAPE_LIST).toContain(a.shape);
    // 不同 id 产出不同形态的样本（8 型 + 大样本必然覆盖多型）
    const shapes = new Set(Array.from({ length: 60 }, (_, i) => bottleStyleOf({ kind: "star", refKey: String(i), id: i + 1 }).shape));
    expect(shapes.size).toBeGreaterThan(3);
  });

  it("未知 kind 回落普通玻璃（健壮性）", () => {
    const s = bottleStyleOf({ kind: "mystery", refKey: "x", id: 5 });
    expect(s.material).toBe("glass");
  });
});
