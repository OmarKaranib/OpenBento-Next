import type { Point, Size } from "@openbento/domain";

/** World-space origin for automatic Card placement. Camera zoom is ignored. */
export const FREE_CARD_ORIGIN: Point = { x: 80, y: 80 };

/** Minimum world-space gap between a new Card and existing Card AABBs. */
export const FREE_CARD_GAP = 32;

/** Reading-order columns before the grid grows another row. */
export const FREE_CARD_COLUMNS = 3;

export type OccupiedCardGeometry = {
  position: Point;
  size: Size;
};

export type FindFreeCardPositionOptions = {
  origin?: Point;
  gap?: number;
  columns?: number;
};

/**
 * First free world position for a new Card.
 *
 * Scans a deterministic reading-order grid (left→right, then down).
 * Does not move existing Cards. Never uses randomness or camera zoom.
 */
export function findFreeCardPosition(
  occupied: ReadonlyArray<OccupiedCardGeometry>,
  candidateSize: Size,
  options: FindFreeCardPositionOptions = {},
): Point {
  const origin = options.origin ?? FREE_CARD_ORIGIN;
  const gap = options.gap ?? FREE_CARD_GAP;
  const columns = options.columns ?? FREE_CARD_COLUMNS;
  const stepX = candidateSize.width + gap;
  const stepY = candidateSize.height + gap;

  for (let row = 0; ; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const candidate: Point = {
        x: origin.x + col * stepX,
        y: origin.y + row * stepY,
      };
      if (!collidesWithOccupied(candidate, candidateSize, occupied, gap)) {
        return candidate;
      }
    }
  }
}

function collidesWithOccupied(
  candidate: Point,
  candidateSize: Size,
  occupied: ReadonlyArray<OccupiedCardGeometry>,
  gap: number,
): boolean {
  for (const card of occupied) {
    if (
      aabbsOverlapWithGap(
        candidate.x,
        candidate.y,
        candidateSize.width,
        candidateSize.height,
        card.position.x,
        card.position.y,
        card.size.width,
        card.size.height,
        gap,
      )
    ) {
      return true;
    }
  }
  return false;
}

/** True when two AABBs are closer than `gap` on either axis. */
export function aabbsOverlapWithGap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  gap: number,
): boolean {
  return (
    ax < bx + bw + gap &&
    ax + aw + gap > bx &&
    ay < by + bh + gap &&
    ay + ah + gap > by
  );
}
