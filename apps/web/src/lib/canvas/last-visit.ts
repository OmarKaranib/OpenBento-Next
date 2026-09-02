/**
 * Browser-local per-Canvas last-visit timestamps.
 *
 * Not server unread. Not synced across devices. Card records are never written.
 *
 * UX (deterministic):
 * - On Canvas load, read lastVisitAt for that canvasId and freeze it as the
 *   visit baseline. Cards with createdAt (else updatedAt) after that baseline
 *   are "new since last visit".
 * - First visit (no stored timestamp) shows no New badges.
 * - lastVisitAt is written when leaving a Canvas (switch to another) or when
 *   the user clicks "Mark seen". Refreshing the same Canvas does not clear New.
 */

import type { Card } from "@openbento/domain";

export const LAST_VISIT_KEY_PREFIX = "openbento:canvas-last-visit:";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export function lastVisitStorageKey(canvasId: string): string {
  return `${LAST_VISIT_KEY_PREFIX}${canvasId}`;
}

export function parseVisitTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

export function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function memoryStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key]! : null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
    removeItem(key: string) {
      delete data[key];
    },
  };
}

export function readLastVisitAt(
  storage: StorageLike | null,
  canvasId: string,
): string | null {
  if (!storage || canvasId.length === 0) {
    return null;
  }
  return parseVisitTimestamp(storage.getItem(lastVisitStorageKey(canvasId)));
}

export function writeLastVisitAt(
  storage: StorageLike | null,
  canvasId: string,
  at: string,
): string | null {
  const iso = parseVisitTimestamp(at);
  if (!storage || !iso || canvasId.length === 0) {
    return null;
  }
  storage.setItem(lastVisitStorageKey(canvasId), iso);
  return iso;
}

/**
 * Prefer createdAt for "new". Fall back to updatedAt only when createdAt is
 * missing or unparseable — never mint a clock value.
 */
export function cardNoveltyTimestamp(
  card: Pick<Card, "createdAt" | "updatedAt">,
): string | null {
  return parseVisitTimestamp(card.createdAt) ?? parseVisitTimestamp(card.updatedAt);
}

export function isCardNewSinceVisit(
  card: Pick<Card, "createdAt" | "updatedAt">,
  lastVisitAt: string | null,
): boolean {
  const baseline = parseVisitTimestamp(lastVisitAt);
  if (!baseline) {
    return false;
  }
  const ts = cardNoveltyTimestamp(card);
  if (!ts) {
    return false;
  }
  return Date.parse(ts) > Date.parse(baseline);
}

export function newCardIdsSinceVisit(
  cards: readonly Pick<Card, "id" | "createdAt" | "updatedAt">[],
  lastVisitAt: string | null,
): string[] {
  return cards
    .filter((card) => isCardNewSinceVisit(card, lastVisitAt))
    .map((card) => card.id);
}

/**
 * Canvas-switch visit accounting. Writes lastVisitAt for the Canvas being
 * left; reads the baseline for the Canvas being entered. Does not modify Cards.
 */
export function applyCanvasVisitChange(args: {
  storage: StorageLike | null;
  previousCanvasId: string | null;
  nextCanvasId: string | null;
  nowIso: string;
}): { baselineAt: string | null; previousCanvasId: string | null } {
  if (
    args.previousCanvasId &&
    args.previousCanvasId !== args.nextCanvasId
  ) {
    writeLastVisitAt(args.storage, args.previousCanvasId, args.nowIso);
  }
  return {
    baselineAt: args.nextCanvasId
      ? readLastVisitAt(args.storage, args.nextCanvasId)
      : null,
    previousCanvasId: args.nextCanvasId,
  };
}

export function markCanvasSeen(
  storage: StorageLike | null,
  canvasId: string,
  nowIso: string,
): string | null {
  return writeLastVisitAt(storage, canvasId, nowIso);
}
