import type { Card, Frame, Rect } from "./types";

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

export type SameCanvasMembershipCode =
  | "missing_frame"
  | "canvas_mismatch"
  | "frame_id_mismatch";

export class SameCanvasMembershipError extends Error {
  readonly code: SameCanvasMembershipCode;

  constructor(code: SameCanvasMembershipCode, message: string) {
    super(message);
    this.name = "SameCanvasMembershipError";
    this.code = code;
  }
}

export type SameCanvasMembershipInput = {
  card: Pick<Card, "canvasId">;
  /** Target membership from SetCardFrameInput. */
  frameId: string | null;
  /**
   * Loaded Frame row for a non-null frameId.
   * Platform must load this in the same owner scope; RLS is not a substitute.
   */
  frame?: Pick<Frame, "id" | "canvasId"> | null;
};

const MEMBERSHIP_MESSAGES: Record<SameCanvasMembershipCode, string> = {
  missing_frame: "setCardFrame requires a Frame when frameId is non-null",
  canvas_mismatch: "Card and Frame must belong to the same Canvas",
  frame_id_mismatch: "setCardFrame frame.id must match frameId",
};

/**
 * Same-canvas Frame membership check.
 *
 * Platform must call this (or `assertSameCanvasMembership`) before applying
 * `setCardFrame`. Do not rely on RLS alone — a Card must not join a Frame on
 * another Canvas.
 *
 * Rejects when:
 * - `frameId` is non-null but `frame` is missing
 * - `frame.id` does not match `frameId`
 * - Card and Frame `canvasId` values differ
 *
 * `frameId: null` clears membership and does not require a Frame row.
 */
export function canSetCardFrame(input: SameCanvasMembershipInput): boolean {
  return sameCanvasMembershipReason(input) === null;
}

export function sameCanvasMembershipReason(
  input: SameCanvasMembershipInput,
): SameCanvasMembershipCode | null {
  const { card, frameId, frame = null } = input;
  if (frameId === null) {
    return null;
  }
  if (frame == null) {
    return "missing_frame";
  }
  if (frame.id !== frameId) {
    return "frame_id_mismatch";
  }
  if (card.canvasId !== frame.canvasId) {
    return "canvas_mismatch";
  }
  return null;
}

/**
 * Throws `SameCanvasMembershipError` when membership would cross Canvases
 * or when `frameId` is set without a loaded Frame.
 */
export function assertSameCanvasMembership(
  card: Pick<Card, "canvasId">,
  frame: Pick<Frame, "id" | "canvasId"> | null | undefined,
  frameId: string | null,
): void {
  const code = sameCanvasMembershipReason({ card, frame, frameId });
  if (code === null) {
    return;
  }
  throw new SameCanvasMembershipError(code, MEMBERSHIP_MESSAGES[code]);
}
