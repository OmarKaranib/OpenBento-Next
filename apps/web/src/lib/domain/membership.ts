import type { Card, Frame, Point, Rect, Size } from "@openbento/domain";
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

/**
 * Slide current members with a Frame. Positions stay world-absolute.
 * After this, remembership ALL cards — a translated member may now sit
 * inside a smaller overlapping Frame.
 */
export function translateFrameMembers(
  cards: ReadonlyArray<Card>,
  frameId: string,
  delta: Point,
): Card[] {
  if (delta.x === 0 && delta.y === 0) {
    return [...cards];
  }
  return cards.map((card) => {
    if (card.frameId !== frameId) {
      return card;
    }
    return {
      ...card,
      position: {
        x: card.position.x + delta.x,
        y: card.position.y + delta.y,
      },
    };
  });
}

/**
 * Re-derive Frame membership for every Card on the canvas.
 *
 * After Frame translate/resize/create, pass ALL current-canvas cards — not
 * only non-members. Cards now outside get `frameId: null`; newly contained
 * cards get the smallest containing Frame. A member that now sits in a
 * smaller overlapping Frame gets that smaller id. Apply each result with
 * `setCardFrame` (executor asserts same-canvas).
 */
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

export type CardGeometryPlan = {
  move?: { cardId: string; position: Point };
  resize?: { cardId: string; size: Size };
  membership?: { cardId: string; frameId: string | null };
};

/**
 * Persist drag/resize: emit moveCard / resizeCard when origin or size
 * change, then remembership from the **new** world bounds (NW/NE/SW
 * resizes move x/y). Apply `membership` with `setCardFrame`.
 */
export function planCardGeometry(
  card: Card,
  next: { position?: Point; size?: Size },
  frames: ReadonlyArray<Frame>,
): CardGeometryPlan {
  const position = next.position ?? card.position;
  const size = next.size ?? card.size;
  const plan: CardGeometryPlan = {};
  if (
    next.position &&
    (next.position.x !== card.position.x || next.position.y !== card.position.y)
  ) {
    plan.move = { cardId: card.id, position };
  }
  if (
    next.size &&
    (next.size.width !== card.size.width || next.size.height !== card.size.height)
  ) {
    plan.resize = { cardId: card.id, size };
  }
  const [change] = membershipCallsForCards([{ ...card, position, size }], frames);
  if (change) {
    plan.membership = change;
  }
  return plan;
}

export type FrameGeometryPlan = {
  move?: { frameId: string; position: Point };
  resize?: { frameId: string; size: Size };
  membership: Array<{ cardId: string; frameId: string | null }>;
};

/**
 * Persist Frame resize: emit moveFrame when NW/NE/SW origin changes,
 * resizeFrame for size, then remembership EVERY card against the new
 * bounds. Cards stay in world coords (no group-translate on resize).
 */
export function planFrameGeometry(
  frame: Frame,
  next: { position?: Point; size?: Size },
  cards: ReadonlyArray<Card>,
  frames: ReadonlyArray<Frame>,
): FrameGeometryPlan {
  const position = next.position ?? { x: frame.bounds.x, y: frame.bounds.y };
  const size = next.size ?? { width: frame.bounds.width, height: frame.bounds.height };
  const plan: FrameGeometryPlan = { membership: [] };
  if (
    next.position &&
    (next.position.x !== frame.bounds.x || next.position.y !== frame.bounds.y)
  ) {
    plan.move = { frameId: frame.id, position };
  }
  if (
    next.size &&
    (next.size.width !== frame.bounds.width ||
      next.size.height !== frame.bounds.height)
  ) {
    plan.resize = { frameId: frame.id, size };
  }
  if (!plan.move && !plan.resize) {
    return plan;
  }
  const nextFrames = frames.map((entry) =>
    entry.id === frame.id
      ? {
          ...entry,
          bounds: {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
          },
        }
      : entry,
  );
  plan.membership = membershipCallsForCards(cards, nextFrames);
  return plan;
}
