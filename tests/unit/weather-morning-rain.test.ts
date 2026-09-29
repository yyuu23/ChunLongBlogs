import { describe, expect, it } from "vitest";
import { computeMorningRain } from "@/lib/seasonal/weather";

/**
 * 晨雨判定回归：旧实现用访客 UTC 日期去匹配 open-meteo（timezone=auto）
 * 的当地时间序列，北京 0-8 点会错查前一天的降水。现在"当地今天"
 * 由调用方从响应 daily.time[0] 取，这里固化匹配逻辑本身的边界。
 */
describe("computeMorningRain：当地时间 6-11 点降水概率 > 40%", () => {
  const times = ["2026-09-28T23:00", "2026-09-29T05:00", "2026-09-29T07:00", "2026-09-29T12:00", "2026-09-30T07:00"];
  const probs = [80, 80, 55, 80, 80];

  it("命中：当地今天 7 点概率 55% > 40%", () => {
    expect(computeMorningRain(times, probs, "2026-09-29")).toBe(true);
  });

  it("不命中：当地今天窗口外（5 点太早、12 点太晚），即使 80% 也不算", () => {
    // 05:00 概率 80（<6 点）、12:00 概率 80（>11 点）都被时间窗排除
    const early = ["2026-09-29T05:00", "2026-09-29T12:00"];
    expect(computeMorningRain(early, [80, 80], "2026-09-29")).toBe(false);
  });

  it("不命中：概率不达标（窗口内 6-11 点最高仅 40%，阈值是 > 40）", () => {
    expect(computeMorningRain(["2026-09-29T08:00"], [40], "2026-09-29")).toBe(false);
  });

  it("关键回归：跨日序列里只匹配传入的当地今天——前一天的晨雨不算今天", () => {
    // 前一天（09-28）无数据、今天（09-29）无降水、次日（09-30）有雨 → false
    const mixed = ["2026-09-29T07:00", "2026-09-30T07:00"];
    expect(computeMorningRain(mixed, [10, 90], "2026-09-29")).toBe(false);
    // 反过来查 09-30 这一天 → true
    expect(computeMorningRain(mixed, [10, 90], "2026-09-30")).toBe(true);
  });

  it("空序列：安全返回 false（todayLocal 为空的情形调用方已用 ?? 链兜住）", () => {
    expect(computeMorningRain([], [], "2026-09-29")).toBe(false);
  });
});
