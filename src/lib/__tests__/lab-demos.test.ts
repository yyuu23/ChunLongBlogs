import { describe, expect, it } from "vitest";
import { LAB_DEMOS, LAB_DEMO_COUNT, labDemoBySlug } from "@/lib/lab-demos";
import { DAILY_CAPS, XP_RULES, normalizeStats, unlockedAchievements } from "@/lib/achievements";

describe("实验台注册表", () => {
  it("slug 唯一且可反查", () => {
    const slugs = LAB_DEMOS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(labDemoBySlug("fireworks")?.slug).toBe("fireworks");
    expect(labDemoBySlug("not-exist")).toBeNull();
  });

  it("visit_lab_demo 事件已接线（XP 规则 + 单日上限）", () => {
    expect(XP_RULES.visit_lab_demo).toBe(3);
    expect(DAILY_CAPS.visit_lab_demo).toBe(5);
  });

  it("demo 成就：玩过 1 个解锁 demo_1，玩遍全部解锁 demo_all", () => {
    expect(unlockedAchievements(normalizeStats({ labDemos: 1, labDemoIds: ["fireworks"] }))).toContain("demo_1");
    expect(unlockedAchievements(normalizeStats({ labDemos: 0 }))).not.toContain("demo_1");

    const all = LAB_DEMOS.map((d) => d.slug);
    expect(LAB_DEMO_COUNT).toBe(all.length);
    expect(unlockedAchievements(normalizeStats({ labDemoIds: all }))).toContain("demo_all");
    expect(unlockedAchievements(normalizeStats({ labDemoIds: all.slice(0, -1) }))).not.toContain("demo_all");
  });
});
