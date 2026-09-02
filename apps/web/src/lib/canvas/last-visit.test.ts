import { describe, expect, it } from "vitest";
import type { Card } from "@openbento/domain";
import {
  applyCanvasVisitChange,
  isCardNewSinceVisit,
  lastVisitStorageKey,
  markCanvasSeen,
  memoryStorage,
  newCardIdsSinceVisit,
  parseVisitTimestamp,
  readLastVisitAt,
  writeLastVisitAt,
} from "./last-visit";

const LAST_VISIT = "2026-08-01T12:00:00.000Z";
const BEFORE = "2026-07-01T00:00:00.000Z";
const AFTER = "2026-08-15T09:00:00.000Z";
const NOW = "2026-09-02T18:00:00.000Z";

function card(args: {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  x?: number;
}): Pick<Card, "id" | "createdAt" | "updatedAt" | "position"> {
  return {
    id: args.id,
    createdAt: args.createdAt ?? BEFORE,
    updatedAt: args.updatedAt ?? args.createdAt ?? BEFORE,
    position: { x: args.x ?? 12, y: 24 },
  };
}

describe("last-visit new detection", () => {
  it("namespaces storage keys by canvasId", () => {
    expect(lastVisitStorageKey("canvas-a")).toBe(
      "openbento:canvas-last-visit:canvas-a",
    );
    expect(parseVisitTimestamp("")).toBeNull();
    expect(parseVisitTimestamp("not a date")).toBeNull();
    expect(parseVisitTimestamp(LAST_VISIT)).toBe(LAST_VISIT);
  });

  it("marks Cards created after lastVisitAt and ignores first visit", () => {
    const older = card({ id: "old", createdAt: BEFORE });
    const newer = card({ id: "new", createdAt: AFTER });
    expect(isCardNewSinceVisit(older, LAST_VISIT)).toBe(false);
    expect(isCardNewSinceVisit(newer, LAST_VISIT)).toBe(true);
    expect(isCardNewSinceVisit(newer, null)).toBe(false);
    expect(newCardIdsSinceVisit([older, newer], LAST_VISIT)).toEqual(["new"]);
  });

  it("prefers createdAt over a later updatedAt", () => {
    const edited = card({
      id: "edited",
      createdAt: BEFORE,
      updatedAt: AFTER,
    });
    expect(isCardNewSinceVisit(edited, LAST_VISIT)).toBe(false);
  });

  it("falls back to updatedAt only when createdAt is not a timestamp", () => {
    const recovered = card({
      id: "recovered",
      createdAt: "",
      updatedAt: AFTER,
    });
    expect(isCardNewSinceVisit(recovered, LAST_VISIT)).toBe(true);
  });

  it("Mark seen and Canvas leave update lastVisitAt without changing Card data", () => {
    const storage = memoryStorage();
    const newer = card({ id: "new", createdAt: AFTER, x: 99 });
    const frozen = { ...newer, position: { ...newer.position } };

    expect(readLastVisitAt(storage, "canvas-a")).toBeNull();
    writeLastVisitAt(storage, "canvas-a", LAST_VISIT);
    expect(isCardNewSinceVisit(newer, readLastVisitAt(storage, "canvas-a"))).toBe(
      true,
    );

    const seenAt = markCanvasSeen(storage, "canvas-a", NOW);
    expect(seenAt).toBe(NOW);
    expect(readLastVisitAt(storage, "canvas-a")).toBe(NOW);
    expect(isCardNewSinceVisit(newer, seenAt)).toBe(false);
    expect(newer).toEqual(frozen);

    const switched = applyCanvasVisitChange({
      storage,
      previousCanvasId: "canvas-a",
      nextCanvasId: "canvas-b",
      nowIso: "2026-09-02T19:00:00.000Z",
    });
    expect(readLastVisitAt(storage, "canvas-a")).toBe(
      "2026-09-02T19:00:00.000Z",
    );
    expect(switched.baselineAt).toBeNull();
    expect(newer.position).toEqual({ x: 99, y: 24 });
  });
});
