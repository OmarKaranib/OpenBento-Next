/**
 * Shared domain types for Canvas, Card, Frame, and WatchBot.
 * Persistence is behind `DomainStore`. Handlers live in `executor.ts`.
 */

export type Actor = "human" | "watchbot" | "webmcp";

/** Server-derived identity. Never accepted on action inputs. */
export type OwnerId = string;

export const CARD_TYPES = [
  "note",
  "article",
  "web",
  "news",
  "youtube",
  "x",
  "reddit",
  "instagram",
  "ai_summary",
  "watchbot_status",
  "timeline",
  "chart",
] as const;
export type CardType = (typeof CARD_TYPES)[number];

/** Externally discovered source Cards. Notes are not in this set. */
export const SOURCE_CARD_TYPES = [
  "article",
  "web",
  "news",
  "youtube",
  "x",
  "reddit",
  "instagram",
] as const;
export type SourceCardType = (typeof SOURCE_CARD_TYPES)[number];

export const SOURCE_TYPES = [
  "web",
  "news",
  "youtube",
  "x",
  "reddit",
  "instagram",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Planned WatchBot source set from the master context. Implementation is later. */
export const WATCHBOT_SOURCE_TYPES = ["web", "news", "youtube", "x"] as const;
export type WatchBotSourceType = (typeof WATCHBOT_SOURCE_TYPES)[number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Provenance for externally discovered source Cards only.
 * Lives on the source payload — never as a fake URL on notes.
 */
export interface CardProvenance {
  sourceUrl: string;
  title: string;
  publishedAt: string;
  sourceType: SourceType;
  author?: string;
  externalId?: string;
  discoveredAt?: string;
  watchBotId?: string;
}

/** Note payload. No provenance field. */
export interface NotePayload {
  text: string;
}

/** Externally discovered source payload. Provenance is required. */
export interface SourceCardPayload {
  provenance: CardProvenance;
}

/** Optional public engagement counts supplied by X. Missing means unknown. */
export interface XCardMetrics {
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
  likeCount?: number;
  viewCount?: number;
  bookmarkCount?: number;
}

export type XCardMediaType = "photo" | "video" | "animated_gif";

/** A bounded, display-only X media attachment. Provider responses are not stored. */
export interface XCardMedia {
  mediaKey: string;
  type: XCardMediaType;
  url?: string;
  previewImageUrl?: string;
  playbackUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  altText?: string;
  viewCount?: number;
}

/** Optional X presentation fields. Provenance remains the source identity. */
export interface XCardPresentation {
  postText?: string;
  authorDisplayName?: string;
  username?: string;
  authorAvatarUrl?: string;
  metrics?: XCardMetrics;
  media?: XCardMedia[];
}

/** Existing `{ provenance }` X payloads remain valid because display fields are optional. */
export interface XCardPayload extends SourceCardPayload, XCardPresentation {}

export interface AiSummaryPayload {
  summary: string;
  sourceCardIds: string[];
}

export interface WatchBotStatusPayload {
  watchBotId: string;
}

export interface TimelinePayload {
  itemCardIds: string[];
}

export interface ChartPayload {
  kind: string;
}

export type CardPayloadByType = {
  note: NotePayload;
  article: SourceCardPayload;
  web: SourceCardPayload;
  news: SourceCardPayload;
  youtube: SourceCardPayload;
  x: XCardPayload;
  reddit: SourceCardPayload;
  instagram: SourceCardPayload;
  ai_summary: AiSummaryPayload;
  watchbot_status: WatchBotStatusPayload;
  timeline: TimelinePayload;
  chart: ChartPayload;
};

export type CardPayload = CardPayloadByType[CardType];

/**
 * Discriminated type/payload pair.
 * `type: "note"` cannot carry a YouTube payload; `type: "youtube"` cannot carry `{ text }`.
 */
export type DiscriminatedCardContent = {
  [K in CardType]: { type: K; payload: CardPayloadByType[K] };
}[CardType];

/** Locked WatchBot lifecycle. */
export const WATCHBOT_STATUSES = ["running", "paused", "error"] as const;
export type WatchBotStatus = (typeof WATCHBOT_STATUSES)[number];

export interface Canvas {
  id: string;
  /** Present on the record; never on action inputs. */
  ownerId: OwnerId;
  name: string;
  viewport: Viewport;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}

export type Card = {
  id: string;
  canvasId: string;
  /**
   * Frame membership. Written via `setCardFrame` after spatial containment.
   * Overlapping Frames: smallest area wins; equal area uses newest createdAt.
   */
  frameId?: string | null;
  position: Point;
  size: Size;
  zIndex?: number;
  createdAt: string;
  updatedAt: string;
} & DiscriminatedCardContent;

export interface Frame {
  id: string;
  canvasId: string;
  name?: string;
  /** Stored world geometry. fullscreenFrame must not rewrite this. */
  bounds: Rect;
  zIndex?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WatchBot {
  id: string;
  /** Present on the record; never on action inputs. */
  ownerId: OwnerId;
  canvasId: string;
  name?: string;
  instruction: string;
  status: WatchBotStatus;
  sourceTypes: WatchBotSourceType[];
  lastError?: string;
  lastActivityAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

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
  sourceUrl: string;
  dedupKey: string;
  noveltyScore?: number;
  discoveredAt: string;
  title?: string;
  publishedAt?: string;
  sourceType?: SourceType;
  cardId?: string;
  detail?: string;
}

export interface CanvasState {
  canvas: Canvas;
  cards: Card[];
  frames: Frame[];
  watchBots: WatchBot[];
}

export interface WatchBotStatusView {
  watchBotId: string;
  canvasId: string;
  status: WatchBotStatus;
  lastActivityAt?: string;
  lastError?: string;
}

/**
 * View-only fullscreen presentation. Not persisted.
 * Must not rewrite Frame.bounds or Card geometry.
 */
export interface FrameFullscreenView {
  frameId: string;
  canvasId: string;
  active: boolean;
}
