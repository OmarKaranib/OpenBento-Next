import { DomainError } from "./errors";
import {
  canvasFromRecord,
  canvasToRecord,
  cardFromRecord,
  cardToRecord,
  columnFromRecord,
  columnToRecord,
  frameFromRecord,
  frameToRecord,
  watchBotEventFromRecord,
  watchBotEventToRecord,
  watchBotFromRecord,
  watchBotToRecord,
} from "./mappers";
import type { DomainSqlAdapter } from "./sql-adapter";
import type { DomainWriteOp } from "./sql-contract";
import type { DomainStore } from "./store";
import type { Canvas, Card, Column, Frame, OwnerId, WatchBot, WatchBotEvent } from "./types";

/**
 * Durable DomainStore. Runtime persist for UI, WebMCP, and the WatchBot
 * worker. Talks to Postgres through a SQL adapter (hosted Supabase or the
 * CI SQL-contract double).
 */
export class SupabaseDomainStore implements DomainStore {
  private buffering = false;
  private buffer: DomainWriteOp[] = [];
  private overlayCanvases = new Map<string, Canvas>();
  private overlayCards = new Map<string, Card>();
  private overlayFrames = new Map<string, Frame>();
  private overlayColumns = new Map<string, Column>();
  private overlayWatchBots = new Map<string, WatchBot>();
  private overlayEvents = new Map<string, WatchBotEvent>();

  constructor(private readonly adapter: DomainSqlAdapter) {}

  async getCanvas(id: string): Promise<Canvas | null> {
    const overlay = this.overlayCanvases.get(id);
    if (overlay) {
      return structuredClone(overlay);
    }
    const row = await this.adapter.getCanvas(id);
    return row ? canvasFromRecord(row) : null;
  }

  async saveCanvas(canvas: Canvas): Promise<void> {
    const op: DomainWriteOp = { op: "upsert_canvas", row: canvasToRecord(canvas) };
    if (this.buffering) {
      this.overlayCanvases.set(canvas.id, structuredClone(canvas));
      this.buffer.push(op);
      return;
    }
    await this.adapter.upsertCanvas(op.row);
  }

  async deleteCanvas(id: string): Promise<void> {
    await this.adapter.deleteCanvas(id);
  }

  async listCanvasesByOwner(ownerId: OwnerId): Promise<Canvas[]> {
    const rows = await this.adapter.listCanvasesByOwner(ownerId);
    const byId = new Map(rows.map((row) => [row.id, canvasFromRecord(row)]));
    for (const canvas of this.overlayCanvases.values()) {
      if (canvas.ownerId === ownerId) {
        byId.set(canvas.id, structuredClone(canvas));
      }
    }
    return [...byId.values()];
  }

  async getCard(id: string): Promise<Card | null> {
    const overlay = this.overlayCards.get(id);
    if (overlay) {
      return structuredClone(overlay);
    }
    const row = await this.adapter.getCard(id);
    return row ? cardFromRecord(row) : null;
  }

  async saveCard(card: Card): Promise<void> {
    const op: DomainWriteOp = { op: "upsert_card", row: cardToRecord(card) };
    if (this.buffering) {
      this.overlayCards.set(card.id, structuredClone(card));
      this.buffer.push(op);
      return;
    }
    await this.adapter.upsertCard(op.row);
  }

  async deleteCard(id: string): Promise<void> {
    await this.adapter.deleteCard(id);
  }

  async listCardsByCanvas(canvasId: string): Promise<Card[]> {
    const rows = await this.adapter.listCardsByCanvas(canvasId);
    const byId = new Map(rows.map((row) => [row.id, cardFromRecord(row)]));
    for (const card of this.overlayCards.values()) {
      if (card.canvasId === canvasId) {
        byId.set(card.id, structuredClone(card));
      }
    }
    return [...byId.values()];
  }

  async getFrame(id: string): Promise<Frame | null> {
    const overlay = this.overlayFrames.get(id);
    if (overlay) {
      return structuredClone(overlay);
    }
    const row = await this.adapter.getFrame(id);
    return row ? frameFromRecord(row) : null;
  }

  async saveFrame(frame: Frame): Promise<void> {
    const op: DomainWriteOp = { op: "upsert_frame", row: frameToRecord(frame) };
    if (this.buffering) {
      this.overlayFrames.set(frame.id, structuredClone(frame));
      this.buffer.push(op);
      return;
    }
    await this.adapter.upsertFrame(op.row);
  }

  async deleteFrame(id: string): Promise<void> {
    await this.adapter.deleteFrame(id);
  }

  async listFramesByCanvas(canvasId: string): Promise<Frame[]> {
    const rows = await this.adapter.listFramesByCanvas(canvasId);
    const byId = new Map(rows.map((row) => [row.id, frameFromRecord(row)]));
    for (const frame of this.overlayFrames.values()) {
      if (frame.canvasId === canvasId) {
        byId.set(frame.id, structuredClone(frame));
      }
    }
    return [...byId.values()];
  }

  async getColumn(id: string): Promise<Column | null> {
    const overlay = this.overlayColumns.get(id);
    if (overlay) {
      return structuredClone(overlay);
    }
    const row = await this.adapter.getColumn(id);
    return row ? columnFromRecord(row) : null;
  }

  async saveColumn(column: Column): Promise<void> {
    const op: DomainWriteOp = {
      op: "upsert_column",
      row: columnToRecord(column),
    };
    if (this.buffering) {
      this.overlayColumns.set(column.id, structuredClone(column));
      this.buffer.push(op);
      return;
    }
    await this.adapter.upsertColumn(op.row);
  }

  async deleteColumn(id: string): Promise<void> {
    await this.adapter.deleteColumn(id);
  }

  async listColumnsByCanvas(canvasId: string): Promise<Column[]> {
    const rows = await this.adapter.listColumnsByCanvas(canvasId);
    const byId = new Map(rows.map((row) => [row.id, columnFromRecord(row)]));
    for (const column of this.overlayColumns.values()) {
      if (column.canvasId === canvasId) {
        byId.set(column.id, structuredClone(column));
      }
    }
    return [...byId.values()];
  }

  async getWatchBot(id: string): Promise<WatchBot | null> {
    const overlay = this.overlayWatchBots.get(id);
    if (overlay) {
      return structuredClone(overlay);
    }
    const row = await this.adapter.getWatchBot(id);
    return row ? watchBotFromRecord(row) : null;
  }

  async saveWatchBot(watchBot: WatchBot): Promise<void> {
    const op: DomainWriteOp = {
      op: "upsert_watch_bot",
      row: watchBotToRecord(watchBot),
    };
    if (this.buffering) {
      this.overlayWatchBots.set(watchBot.id, structuredClone(watchBot));
      this.buffer.push(op);
      return;
    }
    await this.adapter.upsertWatchBot(op.row);
  }

  async listWatchBotsByCanvas(canvasId: string): Promise<WatchBot[]> {
    const rows = await this.adapter.listWatchBotsByCanvas(canvasId);
    const byId = new Map(rows.map((row) => [row.id, watchBotFromRecord(row)]));
    for (const bot of this.overlayWatchBots.values()) {
      if (bot.canvasId === canvasId) {
        byId.set(bot.id, structuredClone(bot));
      }
    }
    return [...byId.values()];
  }

  async listWatchBots(): Promise<WatchBot[]> {
    const rows = await this.adapter.listWatchBots();
    const byId = new Map(rows.map((row) => [row.id, watchBotFromRecord(row)]));
    for (const bot of this.overlayWatchBots.values()) {
      byId.set(bot.id, structuredClone(bot));
    }
    return [...byId.values()];
  }

  async saveWatchBotEvent(event: WatchBotEvent): Promise<void> {
    if (event.cardId) {
      const card =
        this.overlayCards.get(event.cardId) ??
        (await this.getCard(event.cardId));
      if (!card || card.canvasId !== event.canvasId) {
        throw new DomainError(
          "invalid_input",
          "watch_bot_events.card_id must reference a card on the same canvas",
        );
      }
    }
    const existingKeys = new Set(
      (await this.adapter.listWatchBotEvents(event.watchBotId))
        .filter((row) => row.id !== event.id)
        .map((row) => row.dedup_key),
    );
    for (const overlay of this.overlayEvents.values()) {
      if (overlay.watchBotId === event.watchBotId && overlay.id !== event.id) {
        existingKeys.add(overlay.dedupKey);
      }
    }
    if (existingKeys.has(event.dedupKey)) {
      throw new DomainError(
        "conflict",
        "watch_bot_events unique (watch_bot_id, dedup_key) violated",
      );
    }
    const op: DomainWriteOp = {
      op: "insert_watch_bot_event",
      row: watchBotEventToRecord(event),
    };
    if (this.buffering) {
      this.overlayEvents.set(event.id, structuredClone(event));
      this.buffer.push(op);
      return;
    }
    await this.adapter.insertWatchBotEvent(op.row);
  }

  async listWatchBotEventsByWatchBot(
    watchBotId: string,
  ): Promise<WatchBotEvent[]> {
    const rows = await this.adapter.listWatchBotEvents(watchBotId);
    const byId = new Map(
      rows.map((row) => [row.id, watchBotEventFromRecord(row)]),
    );
    for (const event of this.overlayEvents.values()) {
      if (event.watchBotId === watchBotId) {
        byId.set(event.id, structuredClone(event));
      }
    }
    return [...byId.values()];
  }

  async runInTransaction<T>(
    work: (store: DomainStore) => Promise<T>,
  ): Promise<T> {
    const already = this.buffering;
    if (!already) {
      this.buffering = true;
      this.buffer = [];
      this.overlayCanvases.clear();
      this.overlayCards.clear();
      this.overlayFrames.clear();
      this.overlayColumns.clear();
      this.overlayWatchBots.clear();
      this.overlayEvents.clear();
    }
    try {
      const result = await work(this);
      if (!already) {
        await this.adapter.applyTransaction(this.buffer);
      }
      return result;
    } catch (error) {
      throw error;
    } finally {
      if (!already) {
        this.buffering = false;
        this.buffer = [];
        this.overlayCanvases.clear();
        this.overlayCards.clear();
        this.overlayFrames.clear();
        this.overlayColumns.clear();
        this.overlayWatchBots.clear();
        this.overlayEvents.clear();
      }
    }
  }
}
