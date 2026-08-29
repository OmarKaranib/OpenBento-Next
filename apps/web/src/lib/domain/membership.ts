import type { Card, Frame, Rect } from "@openbento/domain";
import { selectSmallestContainingFrame } from "@openbento/domain";

export function cardWorldBounds(card: Pick<Card, "position" | "size">): Rect {
  return {
    x: card.position.x,
    y: card.position.y,
    width: card.size.width,
    height: card.size.height,
  };
}

/**
 * Derive a candidate Frame id from geometry only.
 *
 * Does **not** write `card.frameId`. The UI must pass the result to
 * `setCardFrame`, which the shared executor applies after
 * `assertSameCanvasMembership` / `canSetCardFrame`.
 */
export function resolveCardFrameMembership(
  cardBounds: Rect,
  frames: ReadonlyArray<Pick<Frame, "id" | "bounds" | "createdAt">>,
): string | null {
  return selectSmallestContainingFrame(cardBounds, frames);
}

export function membershipCallsForCards(
  cards: ReadonlyArray<Card>,
  frames: ReadonlyArray<Frame>,
): Array<{ cardId: string; frameId: string | null }> {
  const calls: Array<{ cardId: string; frameId: string | null }> = [];
  for (const card of cards) {
    const next = resolveCardFrameMembership(cardWorldBounds(card), frames);
    const current = card.frameId ?? null;
    if (next !== current) {
      calls.push({ cardId: card.id, frameId: next });
    }
  }
  return calls;
}
