import type { Rect } from "./types";

export function rectArea(rect: Rect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

/** Inclusive containment: `inner` is fully inside `outer`. */
export function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Overlapping Frames: the smallest containing Frame wins `setCardFrame`.
 * Returns `null` when the card is outside every Frame.
 */
export function selectSmallestContainingFrame(
  cardBounds: Rect,
  frames: ReadonlyArray<{ id: string; bounds: Rect }>,
): string | null {
  const containing = frames.filter((frame) =>
    containsRect(frame.bounds, cardBounds),
  );
  if (containing.length === 0) {
    return null;
  }
  return containing.reduce((smallest, current) =>
    rectArea(current.bounds) < rectArea(smallest.bounds) ? current : smallest,
  ).id;
}
