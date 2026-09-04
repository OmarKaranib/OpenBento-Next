import { containsRect } from "./frames";
import type { Card, Column, Frame } from "./types";

/** Inclusive boundary: a fully-contained Column is live; any overflow parks it. */
export function isColumnActive(column: Column, primaryFrame: Frame): boolean {
  return (
    column.canvasId === primaryFrame.canvasId &&
    column.frameId === primaryFrame.id &&
    containsRect(primaryFrame.bounds, column.bounds)
  );
}

/** Inclusive boundary for free Cards. Column membership is a separate concern. */
export function isFreeCardActive(card: Card, primaryFrame: Frame): boolean {
  return (
    !card.columnId &&
    card.canvasId === primaryFrame.canvasId &&
    containsRect(primaryFrame.bounds, {
      ...card.position,
      ...card.size,
    })
  );
}

/** Persisted timestamps define stream order without mutating history. */
export function orderColumnCardsNewestFirst(cards: readonly Card[]): Card[] {
  return [...cards].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}
