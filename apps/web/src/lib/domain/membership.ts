import type { Card, Frame, Rect } from "@openbento/domain";
import {
  canSetCardFrame,
  selectSmallestContainingFrame,
} from "@openbento/domain";

export function cardWorldBounds(card: Pick<Card, "position" | "size">): Rect {
  return {
    x: card.position.x,
    y: card.position.y,
    width: card.size.width,
    height: card.size.height,
  };
}

/**
 * Geometric-feeling Frame membership for the UI path.
 *
 * Uses `selectSmallestContainingFrame` (smallest area; equal-area → newest
 * `createdAt`) then `canSetCardFrame` so a Card cannot join a Frame on
 * another Canvas.
 */
export function resolveCardFrameMembership(
  cardBounds: Rect,
  frames: ReadonlyArray<Frame>,
  card: Pick<Card, "canvasId">,
): string | null {
  const frameId = selectSmallestContainingFrame(cardBounds, frames);
  if (frameId === null) {
    return null;
  }
  const frame = frames.find((entry) => entry.id === frameId);
  if (!canSetCardFrame({ card, frameId, frame: frame ?? null })) {
    return null;
  }
  return frameId;
}

export function membershipCallsForCards(
  cards: ReadonlyArray<Card>,
  frames: ReadonlyArray<Frame>,
): Array<{ cardId: string; frameId: string | null }> {
  const calls: Array<{ cardId: string; frameId: string | null }> = [];
  for (const card of cards) {
    const next = resolveCardFrameMembership(
      cardWorldBounds(card),
      frames,
      card,
    );
    const current = card.frameId ?? null;
    if (next !== current) {
      calls.push({ cardId: card.id, frameId: next });
    }
  }
  return calls;
}
