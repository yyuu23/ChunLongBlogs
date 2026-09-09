import { describe, expect, it } from "vitest";
import { festivalOf, festivalParticleOf, festivalTintOf } from "@/lib/festivals";
import { resolveParticleTheme } from "@/lib/particle-theme";

describe("festival 视觉联动映射", () => {
  it("冬季节气（冬至）→ snow + 冬蓝 tint", () => {
    const dongzhi = festivalOf(new Date("2026-12-22T12:00:00"));
    expect(dongzhi?.key).toBe("solar-dongzhi");
    expect(festivalParticleOf(dongzhi!)).toBe("snow");
    expect(festivalTintOf(dongzhi!)).toBe("#cfe4ff");
  });

  it("2026 春节 → snow + 暖金红 tint", () => {
    const spring = festivalOf(new Date("2026-02-17T12:00:00"));
    expect(spring?.key).toBe("lunar-spring-2026");
    expect(festivalParticleOf(spring!)).toBe("snow");
    expect(festivalTintOf(spring!)).toBe("#ff8f5e");
  });

  it("七夕 → firefly + 鹊桥粉；中秋 → leaf + 月华银白", () => {
    const qixi = festivalOf(new Date("2026-08-19T12:00:00"));
    expect(qixi?.key).toBe("lunar-qixi-2026");
    expect(festivalParticleOf(qixi!)).toBe("firefly");
    expect(festivalTintOf(qixi!)).toBe("#ff9ec7");

    const moon = festivalOf(new Date("2026-09-25T12:00:00"));
    expect(moon?.key).toBe("lunar-moon-2026");
    expect(festivalParticleOf(moon!)).toBe("leaf");
    expect(festivalTintOf(moon!)).toBe("#cfe0ff");
  });
});

describe("resolveParticleTheme（auto/season 统一展开 + 节日优先）", () => {
  const festDay = new Date("2026-12-22T12:00:00"); // 冬至

  it("off → null；手动选定主题不被节日覆盖", () => {
    expect(resolveParticleTheme("off", false, festDay)).toBeNull();
    expect(resolveParticleTheme("sakura", false, festDay)).toBe("sakura");
  });

  it("节日优先：auto/season 当天覆盖为节日主题", () => {
    expect(resolveParticleTheme("auto", false, festDay)).toBe("snow");
    expect(resolveParticleTheme("season", true, festDay)).toBe("snow");
  });

  it("非节日：auto 按日夜、season 按月份", () => {
    const plain = new Date("2026-07-15T12:00:00");
    expect(resolveParticleTheme("auto", true, plain)).toBe("firefly");
    expect(resolveParticleTheme("auto", false, plain)).toBe("sakura");
    expect(resolveParticleTheme("season", false, plain)).toBe("firefly");
    expect(resolveParticleTheme("season", false, new Date("2026-01-15T12:00:00"))).toBe("snow");
  });
});
