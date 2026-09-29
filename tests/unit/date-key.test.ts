import { describe, expect, it } from "vitest";
import { dateKey } from "@/lib/shared/date-key";

/**
 * dateKey：全站「按天结算」的统一业务日口径（北京时间）。
 * 关键性质：结果只取决于北京时刻，与运行机器的时区无关——
 * 曾经签到/积分/节日在 UTC 机器上凌晨 0-8 点会算成前一天。
 * 用例全部以 Date.UTC 显式构造，不依赖测试环境时区。
 */
describe("dateKey：北京时间业务日（与环境时区解耦）", () => {
  it("UTC 前一天 17:00（北京当天 01:00）→ 取北京日期而非 UTC 日期", () => {
    expect(dateKey(new Date(Date.UTC(2026, 8, 28, 17, 0)))).toBe("2026-09-29");
  });

  it("UTC 当天 10:00（北京当天 18:00）→ 仍是同一北京日期", () => {
    expect(dateKey(new Date(Date.UTC(2026, 8, 28, 10, 0)))).toBe("2026-09-28");
  });

  it("北京日界整点切换：23:59 与 00:00 分属两天", () => {
    expect(dateKey(new Date(Date.UTC(2026, 8, 28, 15, 59)))).toBe("2026-09-28"); // 北京 23:59
    expect(dateKey(new Date(Date.UTC(2026, 8, 28, 16, 0)))).toBe("2026-09-29"); // 北京 00:00
  });

  it("月份与年份进位（北京 1/1 凌晨）", () => {
    expect(dateKey(new Date(Date.UTC(2026, 11, 31, 16, 30)))).toBe("2027-01-01"); // 北京 2027-01-01 00:30
  });

  it("缺省参数取当前时刻且恒为 YYYY-MM-DD 格式", () => {
    expect(dateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
