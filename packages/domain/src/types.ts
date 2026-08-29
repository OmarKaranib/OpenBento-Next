/**
 * Shared domain types for Canvas, Card, Frame, and WatchBot.
 * Scaffold only — no runtime behavior.
 */

/** First WatchBot Engineer slice. YouTube and X are later, after web is honest. */
export const FIRST_SLICE_SOURCE_TYPES = ["web", "news"] as const;
export type FirstSliceSourceType = (typeof FIRST_SLICE_SOURCE_TYPES)[number];

export const SOURCE_TYPES = ["web", "news", "youtube", "x"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Provenance is REQUIRED on createCard and updateCard.
 * Field names in application types are camelCase; the local schema sketch
 * uses snake_case (`source_url`, `published_at`, `source_type`).
 */
export interface CardProvenance {
  /** Source URL (schema: `source_url`). */
  sourceUrl: string;
  title: string;
  /** ISO-8601 publish time (schema: `published_at`). */
  publishedAt: string;
  /** schema: `source_type`. First slice: `web` | `news`. */
  sourceType: SourceType;
}

export type WatchBotStatus =
  | "idle"
  | "watching"
  | "acting"
  | "paused"
  | "error";

export interface WatchBot {
  id: string;
  canvasId: string;
  status: WatchBotStatus;
  /** First slice: `web` and/or `news` only. */
  sourceTypes: FirstSliceSourceType[];
  label?: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

/**
 * Discovery / pipeline event used for **dedup** and **novelty**.
 * One row per observed item (or pipeline decision) for a WatchBot.
 */
export type WatchBotEventKind =
  | "discovered"
  | "normalized"
  | "duplicate"
  | "novel"
  | "rejected_relevance"
  | "card_created"
  | "error";

export interface WatchBotEvent {
  id: string;
  watchBotId: string;
  canvasId: string;
  kind: WatchBotEventKind;
  /** Canonical URL used for identity + dedup. */
  sourceUrl: string;
  /**
   * Stable fingerprint for dedup (normalized URL ± title ± published_at,
   * or a content hash). Unique per WatchBot in the proposed sketch.
   */
  dedupKey: string;
  /** Optional novelty signal vs prior discoveries for this WatchBot/canvas. */
  noveltyScore?: number;
  discoveredAt: string;
  title?: string;
  publishedAt?: string;
  sourceType?: SourceType;
  cardId?: string;
  detail?: string;
}

export interface Canvas {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  canvasId: string;
  frameId?: string;
  provenance: CardProvenance;
  body?: string;
  position?: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

export interface Frame {
  id: string;
  canvasId: string;
  label?: string;
  bounds: { x: number; y: number; width: number; height: number };
  fullscreen: boolean;
}

export type Actor = "human" | "watchbot" | "webmcp";
