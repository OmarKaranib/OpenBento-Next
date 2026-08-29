import { describe, expect, it } from "vitest";
import {
  selectSmallestContainingFrame,
  type Frame,
} from "@openbento/domain";
import { InMemoryDomainAdapter } from "./memory-adapter";
import {
  cardWorldBounds,
  membershipCallsForCards,
  resolveCardFrameMembership,
} from "./membership";
import { buildCreateNoteCardInput } from "./note-card";

function frame(partial: {
  id: string;
  canvasId: string;
  bounds: Frame["bounds"];
  createdAt: string;
}): Frame {
  return {
    ...partial,
    name: partial.id,
    updatedAt: partial.createdAt,
  };
}

describe("Frame membership helper usage", () => {
  it("uses selectSmallestContainingFrame and same-canvas checks", () => {
    const outer = frame({
      id: "outer",
      canvasId: "canvas-a",
      bounds: { x: 0, y: 0, width: 400, height: 400 },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const inner = frame({
      id: "inner",
      canvasId: "canvas-a",
      bounds: { x: 50, y: 50, width: 100, height: 100 },
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    const card = {
      canvasId: "canvas-a",
      position: { x: 60, y: 60 },
      size: { width: 20, height: 20 },
    };
    const bounds = cardWorldBounds(card);

    expect(selectSmallestContainingFrame(bounds, [outer, inner])).toBe("inner");
    expect(resolveCardFrameMembership(bounds, [outer, inner], card)).toBe(
      "inner",
    );
    expect(
      resolveCardFrameMembership(
        { x: 1000, y: 1000, width: 10, height: 10 },
        [outer, inner],
        card,
      ),
    ).toBeNull();
  });

  it("breaks equal-area ties with newest createdAt", () => {
    const older = frame({
      id: "aaa-older",
      canvasId: "canvas-a",
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = frame({
      id: "zzz-newer",
      canvasId: "canvas-a",
      bounds: { x: 0, y: 0, width: 50, height: 200 },
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const card = {
      canvasId: "canvas-a",
      position: { x: 10, y: 10 },
      size: { width: 20, height: 20 },
    };
    expect(
      resolveCardFrameMembership(cardWorldBounds(card), [older, newer], card),
    ).toBe("zzz-newer");
  });

  it("refuses a containing Frame on another Canvas", () => {
    const foreign = frame({
      id: "foreign",
      canvasId: "canvas-b",
      bounds: { x: 0, y: 0, width: 200, height: 200 },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const card = {
      canvasId: "canvas-a",
      position: { x: 10, y: 10 },
      size: { width: 20, height: 20 },
    };
    expect(
      resolveCardFrameMembership(cardWorldBounds(card), [foreign], card),
    ).toBeNull();
  });

  it("derives join/leave calls after geometry changes", () => {
    const adapter = new InMemoryDomainAdapter({ seedDefaultCanvas: false });
    const canvas = adapter.execute("createCanvas", { name: "Board" });
    const createdFrame = adapter.execute("createFrame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 300, height: 300 },
      name: "Main",
    });
    const card = adapter.execute(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        position: { x: 20, y: 20 },
        text: "Inside",
      }),
    );

    const join = membershipCallsForCards(
      [card],
      adapter.getSnapshot().frames,
    );
    expect(join).toEqual([{ cardId: card.id, frameId: createdFrame.id }]);
    adapter.execute("setCardFrame", join[0]!);

    const moved = adapter.execute("moveCard", {
      cardId: card.id,
      position: { x: 800, y: 800 },
    });
    const leave = membershipCallsForCards(
      [moved],
      adapter.getSnapshot().frames,
    );
    expect(leave).toEqual([{ cardId: card.id, frameId: null }]);
  });
});
