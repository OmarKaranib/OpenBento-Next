import { describe, expect, it } from "vitest";
import {
  FREE_CARD_COLUMNS,
  FREE_CARD_GAP,
  FREE_CARD_ORIGIN,
  aabbsOverlapWithGap,
  findFreeCardPosition,
  type OccupiedCardGeometry,
} from "./find-free-card-position";
import {
  SOURCE_LINK_DEFAULT_SIZE,
  YOUTUBE_DEFAULT_SIZE,
} from "./domain/source-card";

const SOURCE_SIZE = SOURCE_LINK_DEFAULT_SIZE;
const YOUTUBE_SIZE = YOUTUBE_DEFAULT_SIZE;

function stackedDefaultPosition(index: number): { x: number; y: number } {
  return { x: 80 + index * 24, y: 80 + index * 16 };
}

function occupies(
  position: { x: number; y: number },
  size = SOURCE_SIZE,
): OccupiedCardGeometry {
  return { position, size };
}

function overlapsAny(
  position: { x: number; y: number },
  size: { width: number; height: number },
  occupied: ReadonlyArray<OccupiedCardGeometry>,
  gap = FREE_CARD_GAP,
): boolean {
  return occupied.some((card) =>
    aabbsOverlapWithGap(
      position.x,
      position.y,
      size.width,
      size.height,
      card.position.x,
      card.position.y,
      card.size.width,
      card.size.height,
      gap,
    ),
  );
}

describe("findFreeCardPosition", () => {
  it("returns the first grid slot on an empty canvas", () => {
    expect(findFreeCardPosition([], SOURCE_SIZE)).toEqual(FREE_CARD_ORIGIN);
  });

  it("skips an occupied first slot and returns the next free slot", () => {
    const first = occupies(FREE_CARD_ORIGIN);
    const next = findFreeCardPosition([first], SOURCE_SIZE);
    expect(next).toEqual({
      x: FREE_CARD_ORIGIN.x + SOURCE_SIZE.width + FREE_CARD_GAP,
      y: FREE_CARD_ORIGIN.y,
    });
    expect(overlapsAny(next, SOURCE_SIZE, [first])).toBe(false);
  });

  it("does not pick the colliding 24×16 diagonal stack used by count-based placement", () => {
    const first = occupies(stackedDefaultPosition(0));
    const stackedNext = stackedDefaultPosition(1);
    expect(overlapsAny(stackedNext, SOURCE_SIZE, [first], 0)).toBe(true);

    const free = findFreeCardPosition([first], SOURCE_SIZE);
    expect(free).not.toEqual(stackedNext);
    expect(overlapsAny(free, SOURCE_SIZE, [first])).toBe(false);
    expect(overlapsAny(free, SOURCE_SIZE, [first], 0)).toBe(false);
  });

  it("does not return a position that overlaps existing Cards of real source sizes", () => {
    const occupied: OccupiedCardGeometry[] = [
      occupies({ x: 80, y: 80 }, SOURCE_SIZE),
      occupies({ x: 200, y: 120 }, YOUTUBE_SIZE),
      occupies({ x: 640, y: 400 }, SOURCE_SIZE),
    ];
    const snapshot = occupied.map((card) => ({
      position: { ...card.position },
      size: { ...card.size },
    }));

    const article = findFreeCardPosition(occupied, SOURCE_SIZE);
    const youtube = findFreeCardPosition(occupied, YOUTUBE_SIZE);

    expect(overlapsAny(article, SOURCE_SIZE, occupied)).toBe(false);
    expect(overlapsAny(youtube, YOUTUBE_SIZE, occupied)).toBe(false);
    expect(occupied).toEqual(snapshot);
  });

  it("is deterministic for the same occupied geometries and candidate size", () => {
    const occupied: OccupiedCardGeometry[] = [
      occupies({ x: 48, y: 64 }, SOURCE_SIZE),
      occupies({ x: 400, y: 80 }, YOUTUBE_SIZE),
      occupies({ x: 90, y: 300 }, SOURCE_SIZE),
    ];
    const first = findFreeCardPosition(occupied, SOURCE_SIZE);
    const second = findFreeCardPosition(occupied, SOURCE_SIZE);
    expect(second).toEqual(first);
    expect(findFreeCardPosition(occupied, YOUTUBE_SIZE)).toEqual(
      findFreeCardPosition(occupied, YOUTUBE_SIZE),
    );
  });

  it("grows rows after the column count is filled", () => {
    const row: OccupiedCardGeometry[] = [];
    for (let col = 0; col < FREE_CARD_COLUMNS; col += 1) {
      row.push(
        occupies({
          x: FREE_CARD_ORIGIN.x + col * (SOURCE_SIZE.width + FREE_CARD_GAP),
          y: FREE_CARD_ORIGIN.y,
        }),
      );
    }
    expect(findFreeCardPosition(row, SOURCE_SIZE)).toEqual({
      x: FREE_CARD_ORIGIN.x,
      y: FREE_CARD_ORIGIN.y + SOURCE_SIZE.height + FREE_CARD_GAP,
    });
  });
});
