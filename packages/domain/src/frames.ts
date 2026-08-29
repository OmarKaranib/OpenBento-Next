import type { Rect } from "./types";

export interface FrameContainmentCandidate {
  id: string;
  bounds: Rect;
  createdAt: string;
}

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

function isNewerFrame(
  candidate: FrameContainmentCandidate,
  incumbent: FrameContainmentCandidate,
): boolean {
  if (candidate.createdAt !== incumbent.createdAt) {
    return candidate.createdAt > incumbent.createdAt;
  }
  return candidate.id > incumbent.id;
}

/**
 * Overlapping Frames: smallest area wins `setCardFrame`.
 * Equal-area ties: newest `createdAt` wins.
 * Remaining ties: higher `id` (so array order never decides).
 * Returns `null` when the card is outside every Frame.
 */
export function selectSmallestContainingFrame(
  cardBounds: Rect,
  frames: ReadonlyArray<FrameContainmentCandidate>,
): string | null {
  const containing = frames.filter((frame) =>
    containsRect(frame.bounds, cardBounds),
  );
  if (containing.length === 0) {
    return null;
  }
  return containing.reduce((best, current) => {
    const bestArea = rectArea(best.bounds);
    const currentArea = rectArea(current.bounds);
    if (currentArea < bestArea) {
      return current;
    }
    if (currentArea > bestArea) {
      return best;
    }
    return isNewerFrame(current, best) ? current : best;
  }).id;
}
