/**
 * Current-Canvas WatchBot attribution from snapshot Cards only.
 * Never invents history, provenance, or live worker activity.
 */

import type { Card, WatchBot } from "@openbento/domain";
import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";

export const WATCHBOT_LABEL_FALLBACK = "WatchBot";
export const WATCHBOT_ID_PREVIEW_LENGTH = 8;
export const WATCHBOT_NAME_DISPLAY_MAX = 80;
export const WATCHBOT_CARD_TITLE_DISPLAY_MAX = 160;

export type WatchBotLabelSource = Pick<WatchBot, "id" | "name">;

function trimmedWatchBotId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const id = value.trim();
  return id.length > 0 ? id : null;
}

/** Provenance watchBotId when present on a sourced Card. Notes have none. */
export function cardWatchBotId(card: Card): string | null {
  if (!("provenance" in card.payload)) {
    return null;
  }
  return trimmedWatchBotId(card.payload.provenance.watchBotId);
}

function truncatedWatchBotId(id: string): string {
  const cleaned = sanitizeUntrustedDisplayText(id, WATCHBOT_ID_PREVIEW_LENGTH);
  return cleaned.length > 0 ? cleaned : WATCHBOT_LABEL_FALLBACK;
}

/**
 * Resolve a display label for a WatchBot id from the current snapshot.
 * Named bot → sanitized name. Unnamed bot → "WatchBot".
 * Missing from snapshot → truncated id (or "WatchBot" if unusable).
 * Empty/absent id → null (do not invent attribution).
 */
export function resolveWatchBotLabel(
  watchBotId: unknown,
  watchBots: readonly WatchBotLabelSource[],
): string | null {
  const id = trimmedWatchBotId(watchBotId);
  if (!id) {
    return null;
  }
  const bot = watchBots.find((entry) => entry.id === id);
  if (!bot) {
    return truncatedWatchBotId(id);
  }
  const name = sanitizeUntrustedDisplayText(
    bot.name ?? "",
    WATCHBOT_NAME_DISPLAY_MAX,
  );
  return name.length > 0 ? name : WATCHBOT_LABEL_FALLBACK;
}

export function watchBotAttributionLabel(
  card: Card,
  watchBots: readonly WatchBotLabelSource[],
): string | null {
  return resolveWatchBotLabel(cardWatchBotId(card), watchBots);
}

function cardsProducedByWatchBot(
  cards: readonly Card[],
  watchBotId: unknown,
  canvasId?: string | null,
): Card[] {
  const id = trimmedWatchBotId(watchBotId);
  if (!id) {
    return [];
  }
  return cards.filter((card) => {
    if (canvasId && card.canvasId !== canvasId) {
      return false;
    }
    return cardWatchBotId(card) === id;
  });
}

/** Cards on the current Canvas whose provenance.watchBotId matches. */
export function countCardsForWatchBot(
  cards: readonly Card[],
  watchBotId: unknown,
  canvasId?: string | null,
): number {
  return cardsProducedByWatchBot(cards, watchBotId, canvasId).length;
}

export function watchBotCardCountLabel(count: number): string {
  return count === 1 ? "1 card on this Canvas" : `${count} cards on this Canvas`;
}

function sourcedCardTitle(card: Card): string | null {
  if (!("provenance" in card.payload)) {
    return null;
  }
  const title = sanitizeUntrustedDisplayText(
    card.payload.provenance.title,
    WATCHBOT_CARD_TITLE_DISPLAY_MAX,
  );
  return title.length > 0 ? title : null;
}

/**
 * Newest produced Card title on this Canvas for a WatchBot.
 * Uses max createdAt among matching snapshot Cards. Omits if none / empty title.
 */
export function latestWatchBotCardTitle(
  cards: readonly Card[],
  watchBotId: unknown,
  canvasId?: string | null,
): string | null {
  const matching = cardsProducedByWatchBot(cards, watchBotId, canvasId);
  if (matching.length === 0) {
    return null;
  }
  let latest = matching[0];
  for (const card of matching) {
    if (card.createdAt > latest.createdAt) {
      latest = card;
    }
  }
  return sourcedCardTitle(latest);
}

export type WatchBotCanvasActivity = {
  cardCount: number;
  countLabel: string;
  latestTitle: string | null;
};

export function watchBotCanvasActivity(
  cards: readonly Card[],
  watchBotId: unknown,
  canvasId?: string | null,
): WatchBotCanvasActivity {
  const cardCount = countCardsForWatchBot(cards, watchBotId, canvasId);
  return {
    cardCount,
    countLabel: watchBotCardCountLabel(cardCount),
    latestTitle: latestWatchBotCardTitle(cards, watchBotId, canvasId),
  };
}
