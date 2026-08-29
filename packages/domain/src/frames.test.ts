import { describe, expect, it } from "vitest";
import { describe, expect, it } from "vitest";
import {
  assertSameCanvasMembership,
  canSetCardFrame,
  containsRect,
  SameCanvasMembershipError,
  sameCanvasMembershipReason,
  selectSmallestContainingFrame,
} from "./frames";

describe("frame containment", () => {
  const outer = {
    id: "outer",
    bounds: { x: 0, y: 0, width: 400, height: 400 },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const inner = {
    id: "inner",
    bounds: { x: 50, y: 50, width: 100, height: 100 },
    createdAt: "2026-01-02T00:00:00.000Z",
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

  it("breaks equal-area ties with newest createdAt, ignoring array order", () => {
    const older = {
      id: "aaa-older",
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const newer = {
      id: "zzz-newer",
      bounds: { x: 0, y: 0, width: 50, height: 200 },
      createdAt: "2026-08-01T00:00:00.000Z",
    };
    const inside = { x: 10, y: 10, width: 20, height: 20 };

    expect(selectSmallestContainingFrame(inside, [older, newer])).toBe(
      "zzz-newer",
    );
    expect(selectSmallestContainingFrame(inside, [newer, older])).toBe(
      "zzz-newer",
    );
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

describe("same-canvas Frame membership", () => {
  const card = { canvasId: "canvas-a" };
  const frame = { id: "frame-1", canvasId: "canvas-a" };

  it("allows clearing membership when frameId is null", () => {
    expect(canSetCardFrame({ card, frameId: null })).toBe(true);
    expect(canSetCardFrame({ card, frameId: null, frame: null })).toBe(true);
    expect(() => assertSameCanvasMembership(card, null, null)).not.toThrow();
  });

  it("rejects when frameId is non-null but frame is missing", () => {
    expect(canSetCardFrame({ card, frameId: "frame-1" })).toBe(false);
    expect(canSetCardFrame({ card, frameId: "frame-1", frame: null })).toBe(
      false,
    );
    expect(sameCanvasMembershipReason({ card, frameId: "frame-1" })).toBe(
      "missing_frame",
    );
    expect(() => assertSameCanvasMembership(card, undefined, "frame-1")).toThrow(
      SameCanvasMembershipError,
    );
  });

  it("rejects when Card and Frame canvas IDs differ", () => {
    const otherFrame = { id: "frame-1", canvasId: "canvas-b" };
    expect(
      canSetCardFrame({ card, frameId: "frame-1", frame: otherFrame }),
    ).toBe(false);
    expect(
      sameCanvasMembershipReason({
        card,
        frameId: "frame-1",
        frame: otherFrame,
      }),
    ).toBe("canvas_mismatch");
    expect(() =>
      assertSameCanvasMembership(card, otherFrame, "frame-1"),
    ).toThrow(/same Canvas/);
  });

  it("rejects when the loaded Frame id does not match frameId", () => {
    expect(
      canSetCardFrame({ card, frameId: "frame-other", frame }),
    ).toBe(false);
    expect(
      sameCanvasMembershipReason({ card, frameId: "frame-other", frame }),
    ).toBe("frame_id_mismatch");
  });

  it("allows membership when Card and Frame share a canvas", () => {
    expect(canSetCardFrame({ card, frameId: "frame-1", frame })).toBe(true);
    expect(() =>
      assertSameCanvasMembership(card, frame, "frame-1"),
    ).not.toThrow();
  });
});
