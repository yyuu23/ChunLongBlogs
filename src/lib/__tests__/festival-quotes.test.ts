import { describe, expect, it } from "vitest";
import { parseFestivalQuotes, stringifyFestivalQuotes } from "@/lib/festival-quotes";

describe("节气语录：文本 ↔ 配置互转（admin textarea 用）", () => {
  it("每行 key | 语录，容忍空行与缺分隔符", () => {
    const q = parseFestivalQuotes("solar-dongzhi | 冬至快乐，记得吃饺子\n\n没有分隔符的行\nlunar-moon-2026 | 今晚的月亮很圆 ");
    expect(q).toEqual({
      "solar-dongzhi": "冬至快乐，记得吃饺子",
      "lunar-moon-2026": "今晚的月亮很圆",
    });
  });

  it("roundtrip 无损（stringify 按 key 排序）", () => {
    const q = { "lunar-moon-2026": "月圆", "solar-lichun": "春来了" };
    expect(parseFestivalQuotes(stringifyFestivalQuotes(q))).toEqual(q);
  });

  it("空值安全", () => {
    expect(stringifyFestivalQuotes(undefined)).toBe("");
    expect(parseFestivalQuotes("")).toEqual({});
  });
});
