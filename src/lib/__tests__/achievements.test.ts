import { describe, expect, it } from "vitest";
import { EMPTY_STATS, levelOf, normalizeStats, unlockedAchievements } from "@/lib/achievements";

describe("levelOf：等级曲线 40*(lvl-1)^2", () => {
  it("0 经验 = Lv1，39 仍是 Lv1，40 升 Lv2", () => {
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(39).level).toBe(1);
    expect(levelOf(40).level).toBe(2);
    expect(levelOf(160).level).toBe(3); // sqrt(160/40)=2 → Lv3
  });

  it("区间边界与进度", () => {
    const l = levelOf(40);
    expect(l.currentNeed).toBe(40);
    expect(l.nextNeed).toBe(160);
    expect(l.progress).toBe(0);
    expect(levelOf(100).progress).toBeCloseTo(0.5, 5); // (100-40)/(160-40)
  });

  it("段位：Lv8 银（xp 1960），Lv15 金（xp 7840）", () => {
    expect(levelOf(1959).tier).toBe("bronze");
    expect(levelOf(1960).level).toBe(8);
    expect(levelOf(1960).tier).toBe("silver");
    expect(levelOf(7840).level).toBe(15);
    expect(levelOf(7840).tier).toBe("gold");
  });
});

describe("normalizeStats：老数据补默认值", () => {
  it("null/undefined 返回全零默认", () => {
    const s = normalizeStats(null);
    expect(s.postsRead).toBe(0);
    expect(s.accentsTried).toEqual([]);
    expect(s.eggFound).toBe(false);
  });

  it("部分字段合并，缺的补默认（不炸 check()）", () => {
    const s = normalizeStats({ postsRead: 5 });
    expect(s.postsRead).toBe(5);
    expect(s.visitDays).toBe(0);
    expect(s.readPostIds).toEqual([]);
  });
});

describe("unlockedAchievements", () => {
  it("空数据也解锁 first_visit（check 恒真）", () => {
    expect(unlockedAchievements(EMPTY_STATS)).toContain("first_visit");
  });

  it("阈值成就按 stats 判定", () => {
    expect(unlockedAchievements(normalizeStats({ labVisits: 1 }))).toContain("lab_1");
    expect(unlockedAchievements(normalizeStats({ visitDays: 7 }))).toContain("day_7");
    expect(unlockedAchievements(normalizeStats({ postsRead: 25 }))).toContain("reader_25");
    // 差一步不解锁
    expect(unlockedAchievements(normalizeStats({ postsRead: 24 }))).not.toContain("reader_25");
  });
});
