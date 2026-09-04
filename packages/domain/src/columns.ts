import { containsRect } from "./frames";
import type { Card, Column, Frame, Point, Rect, Size } from "./types";

export const COLUMN_SLOT_GAP = 24;
export const COLUMN_FRAME_INSET_X = 40;
export const COLUMN_FRAME_INSET_Y = 60;

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Deterministic simple slots: fill fully-contained dashboard cells first,
 * then place whole Columns in non-overlapping parking slots to the right.
 */
export function defaultColumnPosition(
  primaryFrame: Frame,
  columns: readonly Column[],
  size: Size,
): Point {
  const left = primaryFrame.bounds.x + COLUMN_FRAME_INSET_X;
  const top = primaryFrame.bounds.y + COLUMN_FRAME_INSET_Y;
  const right =
    primaryFrame.bounds.x + primaryFrame.bounds.width - COLUMN_FRAME_INSET_X;
  const bottom =
    primaryFrame.bounds.y + primaryFrame.bounds.height - COLUMN_FRAME_INSET_Y;
  const occupied = columns.map((column) => column.bounds);

  for (let y = top; y + size.height <= bottom; y += size.height + COLUMN_SLOT_GAP) {
    for (let x = left; x + size.width <= right; x += size.width + COLUMN_SLOT_GAP) {
      const candidate = { x, y, ...size };
      if (!occupied.some((bounds) => overlaps(candidate, bounds))) {
        return { x, y };
      }
    }
  }

  const parkingLeft = primaryFrame.bounds.x + primaryFrame.bounds.width + 40;
  for (let index = 0; ; index += 1) {
    const candidate = {
      x: parkingLeft + index * (size.width + COLUMN_SLOT_GAP),
      y: top,
      ...size,
    };
    if (!occupied.some((bounds) => overlaps(candidate, bounds))) {
      return { x: candidate.x, y: candidate.y };
    }
  }
}

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
