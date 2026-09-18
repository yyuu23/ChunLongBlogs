import { describe, expect, it } from "vitest";
import { mergeBottleOrder, reorderBottleIds } from "@/lib/bottles/order";

describe("bottle order", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it("keeps stored bottles first and appends newly earned bottles", () => {
    expect(mergeBottleOrder(items, [2, 1]).map((item) => item.id)).toEqual([2, 1, 3]);
  });

  it("moves an item relative to a target without mutating the source", () => {
    const source = [1, 2, 3];
    expect(reorderBottleIds(source, 1, 3, "after")).toEqual([2, 3, 1]);
    expect(source).toEqual([1, 2, 3]);
  });
});
