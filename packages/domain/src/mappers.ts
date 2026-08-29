import { cardContentOf, cardFromContent } from "./card-content";
import { DomainError } from "./errors";
import type {
  CanvasRecord,
  CardRecord,
  FrameRecord,
  WatchBotEventRecord,
  WatchBotRecord,
} from "./schema";
import {
  CARD_TYPES,
  WATCHBOT_SOURCE_TYPES,
  WATCHBOT_STATUSES,
  type Canvas,
  type Card,
  type CardType,
  type Frame,
  type WatchBot,
  type WatchBotEvent,
  type WatchBotSourceType,
} from "./types";

function isCardType(value: string): value is CardType {
  return (CARD_TYPES as readonly string[]).includes(value);
}

function isWatchBotSourceType(value: string): value is WatchBotSourceType {
  return (WATCHBOT_SOURCE_TYPES as readonly string[]).includes(value);
}

export function canvasFromRecord(row: CanvasRecord): Canvas {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    viewport: {
      x: row.viewport_x,
      y: row.viewport_y,
      zoom: row.viewport_zoom,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at ?? undefined,
  };
}

export function canvasToRecord(canvas: Canvas): CanvasRecord {
  return {
    id: canvas.id,
    owner_id: canvas.ownerId,
    name: canvas.name,
    viewport_x: canvas.viewport.x,
    viewport_y: canvas.viewport.y,
    viewport_zoom: canvas.viewport.zoom,
    created_at: canvas.createdAt,
    updated_at: canvas.updatedAt,
    last_opened_at: canvas.lastOpenedAt ?? null,
  };
}

export function cardFromRecord(row: CardRecord): Card {
  if (!isCardType(row.type)) {
    throw new DomainError(
      "invalid_input",
      "Card record type and payload do not match PAYLOAD_SCHEMAS",
    );
  }
  try {
    return cardFromContent(
      {
        id: row.id,
        canvasId: row.canvas_id,
        frameId: row.frame_id,
        position: { x: row.x, y: row.y },
        size: { width: row.width, height: row.height },
        zIndex: row.z_index ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      cardContentOf(row.type, row.payload),
    );
  } catch (error) {
    if (error instanceof DomainError) {
      throw new DomainError(
        "invalid_input",
        "Card record type and payload do not match PAYLOAD_SCHEMAS",
      );
    }
    throw error;
  }
}

export function cardToRecord(card: Card): CardRecord {
  return {
    id: card.id,
    canvas_id: card.canvasId,
    frame_id: card.frameId ?? null,
    type: card.type,
    payload: { ...card.payload },
    x: card.position.x,
    y: card.position.y,
    width: card.size.width,
    height: card.size.height,
    z_index: card.zIndex ?? null,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  };
}

export function frameFromRecord(row: FrameRecord): Frame {
  return {
    id: row.id,
    canvasId: row.canvas_id,
    name: row.name ?? undefined,
    bounds: {
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
    },
    zIndex: row.z_index ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function frameToRecord(frame: Frame): FrameRecord {
  return {
    id: frame.id,
    canvas_id: frame.canvasId,
    name: frame.name ?? null,
    x: frame.bounds.x,
    y: frame.bounds.y,
    width: frame.bounds.width,
    height: frame.bounds.height,
    z_index: frame.zIndex ?? null,
    created_at: frame.createdAt,
    updated_at: frame.updatedAt,
  };
}

export function watchBotFromRecord(row: WatchBotRecord): WatchBot {
  if (
    !(WATCHBOT_STATUSES as readonly string[]).includes(row.status) ||
    !row.source_types.every(isWatchBotSourceType)
  ) {
    throw new DomainError("invalid_input", "WatchBot record is invalid");
  }
  return {
    id: row.id,
    ownerId: row.owner_id,
    canvasId: row.canvas_id,
    name: row.name ?? undefined,
    instruction: row.instruction,
    status: row.status,
    sourceTypes: [...row.source_types],
    lastError: row.last_error ?? undefined,
    lastActivityAt: row.last_activity_at ?? undefined,
    nextRunAt: row.next_run_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function watchBotToRecord(watchBot: WatchBot): WatchBotRecord {
  return {
    id: watchBot.id,
    owner_id: watchBot.ownerId,
    canvas_id: watchBot.canvasId,
    name: watchBot.name ?? null,
    instruction: watchBot.instruction,
    status: watchBot.status,
    source_types: [...watchBot.sourceTypes],
    last_error: watchBot.lastError ?? null,
    last_activity_at: watchBot.lastActivityAt ?? null,
    next_run_at: watchBot.nextRunAt ?? null,
    created_at: watchBot.createdAt,
    updated_at: watchBot.updatedAt,
  };
}

/**
 * watch_bot_events.published_at is timestamptz. Empty / unknown / unparseable
 * must be SQL null — `?? null` does not coerce `""`, and `''::timestamptz`
 * is 22007. Card JSON provenance.publishedAt stays `""` when unknown.
 */
export function publishedAtToTimestamptz(
  value: string | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

export function watchBotEventFromRecord(
  row: WatchBotEventRecord,
): WatchBotEvent {
  return {
    id: row.id,
    watchBotId: row.watch_bot_id,
    canvasId: row.canvas_id,
    kind: row.kind,
    sourceUrl: row.source_url,
    dedupKey: row.dedup_key,
    noveltyScore: row.novelty_score ?? undefined,
    discoveredAt: row.discovered_at,
    title: row.title ?? undefined,
    publishedAt: row.published_at ?? undefined,
    sourceType: row.source_type ?? undefined,
    cardId: row.card_id ?? undefined,
    detail: row.detail ?? undefined,
  };
}

export function watchBotEventToRecord(event: WatchBotEvent): WatchBotEventRecord {
  return {
    id: event.id,
    watch_bot_id: event.watchBotId,
    canvas_id: event.canvasId,
    kind: event.kind,
    source_url: event.sourceUrl,
    dedup_key: event.dedupKey,
    novelty_score: event.noveltyScore ?? null,
    discovered_at: event.discoveredAt,
    title: event.title ?? null,
    published_at: publishedAtToTimestamptz(event.publishedAt),
    source_type: event.sourceType ?? null,
    card_id: event.cardId ?? null,
    detail: event.detail ?? null,
  };
}
