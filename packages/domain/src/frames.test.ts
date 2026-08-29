import { describe, expect, it } from "vitest";
import { containsRect, selectSmallestContainingFrame } from "./frames";

describe("frame containment", () => {
  const outer = {
    id: "outer",
    bounds: { x: 0, y: 0, width: 400, height: 400 },
  };
  const inner = {
    id: "inner",
    bounds: { x: 50, y: 50, width: 100, height: 100 },
  };
  const card = { x: 60, y: 60, width: 20, height: 20 };

  it("detects full containment", () => {
    expect(containsRect(outer.bounds, card)).toBe(true);
    expect(containsRect(inner.bounds, card)).toBe(true);
    expect(containsRect(inner.bounds, outer.bounds)).toBe(false);
  });

  it("picks the smallest containing Frame when Frames overlap", () => {
    expect(selectSmallestContainingFrame(card, [outer, inner])).toBe("inner");
    expect(selectSmallestContainingFrame(card, [inner, outer])).toBe("inner");
  });

  it("returns null when the card is outside every Frame", () => {
    expect(
      selectSmallestContainingFrame(
        { x: 1000, y: 1000, width: 10, height: 10 },
        [outer, inner],
      ),
    ).toBeNull();
  });
});
