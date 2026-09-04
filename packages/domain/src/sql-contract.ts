import { DomainError } from "./errors";
import type {
  CanvasRecord,
  CardRecord,
  ColumnRecord,
  FrameRecord,
  WatchBotEventRecord,
  WatchBotRecord,
} from "./schema";
import type { OwnerId } from "./types";

export type DomainWriteOp =
  | { op: "upsert_canvas"; row: CanvasRecord }
  | { op: "upsert_card"; row: CardRecord }
  | { op: "upsert_frame"; row: FrameRecord }
  | { op: "upsert_column"; row: ColumnRecord }
  | { op: "upsert_watch_bot"; row: WatchBotRecord }
  | { op: "insert_watch_bot_event"; row: WatchBotEventRecord };

/**
 * Shared table state that mirrors the local/dev SQL contract:
 * unique (watch_bot_id, dedup_key), same-canvas card.frame_id,
 * same-canvas watch_bot_events.card_id, owner-scoped RLS.
 */
export class SharedSqlTables {
  canvases = new Map<string, CanvasRecord>();
  cards = new Map<string, CardRecord>();
  frames = new Map<string, FrameRecord>();
  columns = new Map<string, ColumnRecord>();
  watchBots = new Map<string, WatchBotRecord>();
  watchBotEvents = new Map<string, WatchBotEventRecord>();

  snapshot(): SharedSqlTables {
    const copy = new SharedSqlTables();
    copy.canvases = new Map(this.canvases);
    copy.cards = new Map(this.cards);
    copy.frames = new Map(this.frames);
    copy.columns = new Map(this.columns);
    copy.watchBots = new Map(this.watchBots);
    copy.watchBotEvents = new Map(this.watchBotEvents);
    return copy;
  }

  restore(snapshot: SharedSqlTables): void {
    this.canvases = new Map(snapshot.canvases);
    this.cards = new Map(snapshot.cards);
    this.frames = new Map(snapshot.frames);
    this.columns = new Map(snapshot.columns);
    this.watchBots = new Map(snapshot.watchBots);
    this.watchBotEvents = new Map(snapshot.watchBotEvents);
  }
}

export interface SqlContractSession {
  /** auth.uid() for RLS. Null + bypassRls is the worker scan. */
  ownerId: OwnerId | null;
  bypassRls?: boolean;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class SqlContractEngine {
  constructor(
    readonly tables: SharedSqlTables,
    readonly session: SqlContractSession,
  ) {}

  private canSeeCanvas(row: CanvasRecord): boolean {
    if (this.session.bypassRls) {
      return true;
    }
    return this.session.ownerId !== null && row.owner_id === this.session.ownerId;
  }

  private canvasOwner(canvasId: string): OwnerId | undefined {
    return this.tables.canvases.get(canvasId)?.owner_id;
  }

  private canSeeCanvasId(canvasId: string): boolean {
    const canvas = this.tables.canvases.get(canvasId);
    return canvas ? this.canSeeCanvas(canvas) : false;
  }

  listCanvases(): CanvasRecord[] {
    return [...this.tables.canvases.values()]
      .filter((row) => this.canSeeCanvas(row))
      .map((row) => clone(row));
  }

  getCanvas(id: string): CanvasRecord | null {
    const row = this.tables.canvases.get(id);
    if (!row || !this.canSeeCanvas(row)) {
      return null;
    }
    return clone(row);
  }

  upsertCanvas(row: CanvasRecord): void {
    if (!this.session.bypassRls) {
      if (!this.session.ownerId || row.owner_id !== this.session.ownerId) {
        throw new DomainError("not_found", "Canvas not found");
      }
    }
    this.tables.canvases.set(row.id, clone(row));
  }

  deleteCanvas(id: string): void {
    const canvas = this.tables.canvases.get(id);
    if (!canvas || !this.canSeeCanvas(canvas)) {
      throw new DomainError("not_found", "Canvas not found");
    }
    for (const [eventId, event] of this.tables.watchBotEvents) {
      if (event.canvas_id === id) {
        this.tables.watchBotEvents.delete(eventId);
      }
    }
    for (const [watchBotId, watchBot] of this.tables.watchBots) {
      if (watchBot.canvas_id === id) {
        this.tables.watchBots.delete(watchBotId);
      }
    }
    for (const [cardId, card] of this.tables.cards) {
      if (card.canvas_id === id) {
        this.tables.cards.delete(cardId);
      }
    }
    for (const [frameId, frame] of this.tables.frames) {
      if (frame.canvas_id === id) {
        this.tables.frames.delete(frameId);
      }
    }
    for (const [columnId, column] of this.tables.columns) {
      if (column.canvas_id === id) {
        this.tables.columns.delete(columnId);
      }
    }
    this.tables.canvases.delete(id);
  }

  getCard(id: string): CardRecord | null {
    const row = this.tables.cards.get(id);
    if (!row || !this.canSeeCanvasId(row.canvas_id)) {
      return null;
    }
    return clone(row);
  }

  upsertCard(row: CardRecord): void {
    if (!this.canSeeCanvasId(row.canvas_id) && !this.session.bypassRls) {
      throw new DomainError("not_found", "Card canvas not found");
    }
    if (row.frame_id) {
      const frame = this.tables.frames.get(row.frame_id);
      if (!frame || frame.canvas_id !== row.canvas_id) {
        throw new DomainError(
          "invalid_input",
          "cards.frame_id must reference a frame on the same canvas",
        );
      }
    }
    if (row.column_id) {
      const column = this.tables.columns.get(row.column_id);
      if (
        !column ||
        column.canvas_id !== row.canvas_id ||
        column.frame_id !== row.frame_id
      ) {
        throw new DomainError(
          "invalid_input",
          "cards.column_id must reference a Column in the same primary Frame",
        );
      }
    }
    this.tables.cards.set(row.id, clone(row));
  }

  deleteCard(id: string): void {
    const card = this.tables.cards.get(id);
    if (!card || (!this.canSeeCanvasId(card.canvas_id) && !this.session.bypassRls)) {
      throw new DomainError("not_found", "Card not found");
    }
    this.tables.cards.delete(id);
    for (const [eventId, event] of this.tables.watchBotEvents) {
      if (event.card_id === id) {
        this.tables.watchBotEvents.set(eventId, { ...event, card_id: null });
      }
    }
  }

  listCardsByCanvas(canvasId: string): CardRecord[] {
    if (!this.canSeeCanvasId(canvasId) && !this.session.bypassRls) {
      return [];
    }
    return [...this.tables.cards.values()]
      .filter((row) => row.canvas_id === canvasId)
      .map((row) => clone(row));
  }

  getFrame(id: string): FrameRecord | null {
    const row = this.tables.frames.get(id);
    if (!row || !this.canSeeCanvasId(row.canvas_id)) {
      return null;
    }
    return clone(row);
  }

  upsertFrame(row: FrameRecord): void {
    if (!this.canSeeCanvasId(row.canvas_id) && !this.session.bypassRls) {
      throw new DomainError("not_found", "Frame canvas not found");
    }
    const canvas = this.tables.canvases.get(row.canvas_id);
    if (canvas && canvas.primary_frame_id !== row.id) {
      throw new DomainError("conflict", "Canvas already has a primary Frame");
    }
    const other = [...this.tables.frames.values()].find(
      (frame) => frame.canvas_id === row.canvas_id && frame.id !== row.id,
    );
    if (other) {
      throw new DomainError("conflict", "Canvas already has a primary Frame");
    }
    this.tables.frames.set(row.id, clone(row));
  }

  deleteFrame(id: string): void {
    const frame = this.tables.frames.get(id);
    if (!frame || (!this.canSeeCanvasId(frame.canvas_id) && !this.session.bypassRls)) {
      throw new DomainError("not_found", "Frame not found");
    }
    throw new DomainError("conflict", "The primary Frame cannot be deleted");
  }

  listFramesByCanvas(canvasId: string): FrameRecord[] {
    if (!this.canSeeCanvasId(canvasId) && !this.session.bypassRls) {
      return [];
    }
    return [...this.tables.frames.values()]
      .filter((row) => row.canvas_id === canvasId)
      .map((row) => clone(row));
  }

  getColumn(id: string): ColumnRecord | null {
    const row = this.tables.columns.get(id);
    if (!row || !this.canSeeCanvasId(row.canvas_id)) {
      return null;
    }
    return clone(row);
  }

  upsertColumn(row: ColumnRecord): void {
    if (!this.canSeeCanvasId(row.canvas_id) && !this.session.bypassRls) {
      throw new DomainError("not_found", "Column canvas not found");
    }
    const canvas = this.tables.canvases.get(row.canvas_id);
    const frame = this.tables.frames.get(row.frame_id);
    if (
      !canvas ||
      !frame ||
      frame.canvas_id !== row.canvas_id ||
      canvas.primary_frame_id !== row.frame_id
    ) {
      throw new DomainError(
        "invalid_input",
        "Column must reference the primary Frame on the same Canvas",
      );
    }
    this.tables.columns.set(row.id, clone(row));
  }

  deleteColumn(id: string): void {
    const column = this.tables.columns.get(id);
    if (
      !column ||
      (!this.canSeeCanvasId(column.canvas_id) && !this.session.bypassRls)
    ) {
      throw new DomainError("not_found", "Column not found");
    }
    if ([...this.tables.cards.values()].some((card) => card.column_id === id)) {
      throw new DomainError(
        "invalid_input",
        "Column cannot be deleted while Cards still reference it",
      );
    }
    if ([...this.tables.watchBots.values()].some((bot) => bot.column_id === id)) {
      throw new DomainError(
        "invalid_input",
        "A dedicated WatchBot Column cannot be deleted",
      );
    }
    this.tables.columns.delete(id);
  }

  listColumnsByCanvas(canvasId: string): ColumnRecord[] {
    if (!this.canSeeCanvasId(canvasId) && !this.session.bypassRls) {
      return [];
    }
    return [...this.tables.columns.values()]
      .filter((row) => row.canvas_id === canvasId)
      .map((row) => clone(row));
  }

  getWatchBot(id: string): WatchBotRecord | null {
    const row = this.tables.watchBots.get(id);
    if (!row) {
      return null;
    }
    if (
      !this.session.bypassRls &&
      (row.owner_id !== this.session.ownerId || !this.canSeeCanvasId(row.canvas_id))
    ) {
      return null;
    }
    return clone(row);
  }

  upsertWatchBot(row: WatchBotRecord): void {
    const canvas = this.tables.canvases.get(row.canvas_id);
    if (!canvas) {
      throw new DomainError("not_found", "WatchBot canvas not found");
    }
    if (canvas.owner_id !== row.owner_id) {
      throw new DomainError(
        "invalid_input",
        "WatchBot owner must match the canvas owner",
      );
    }
    const column = this.tables.columns.get(row.column_id);
    if (!column || column.canvas_id !== row.canvas_id) {
      throw new DomainError(
        "invalid_input",
        "WatchBot Column must belong to the same Canvas",
      );
    }
    const other = [...this.tables.watchBots.values()].find(
      (bot) => bot.column_id === row.column_id && bot.id !== row.id,
    );
    if (other) {
      throw new DomainError("conflict", "A Column can have at most one WatchBot");
    }
    if (
      !this.session.bypassRls &&
      (row.owner_id !== this.session.ownerId || !this.canSeeCanvas(canvas))
    ) {
      throw new DomainError("not_found", "WatchBot canvas not found");
    }
    this.tables.watchBots.set(row.id, clone(row));
  }

  listWatchBotsByCanvas(canvasId: string): WatchBotRecord[] {
    return [...this.tables.watchBots.values()]
      .filter((row) => {
        if (row.canvas_id !== canvasId) {
          return false;
        }
        if (this.session.bypassRls) {
          return true;
        }
        return (
          row.owner_id === this.session.ownerId && this.canSeeCanvasId(canvasId)
        );
      })
      .map((row) => clone(row));
  }

  listWatchBots(): WatchBotRecord[] {
    return [...this.tables.watchBots.values()]
      .filter((row) => {
        if (this.session.bypassRls) {
          return true;
        }
        return (
          row.owner_id === this.session.ownerId &&
          this.canSeeCanvasId(row.canvas_id)
        );
      })
      .map((row) => clone(row));
  }

  insertWatchBotEvent(row: WatchBotEventRecord): void {
    const bot = this.tables.watchBots.get(row.watch_bot_id);
    if (!bot || bot.canvas_id !== row.canvas_id) {
      throw new DomainError(
        "invalid_input",
        "watch_bot_events.canvas_id must match the WatchBot canvas",
      );
    }
    if (
      !this.session.bypassRls &&
      (bot.owner_id !== this.session.ownerId ||
        this.canvasOwner(row.canvas_id) !== this.session.ownerId)
    ) {
      throw new DomainError("not_found", "WatchBot event not found");
    }
    if (row.card_id) {
      const card = this.tables.cards.get(row.card_id);
      if (!card || card.canvas_id !== row.canvas_id) {
        throw new DomainError(
          "invalid_input",
          "watch_bot_events.card_id must reference a card on the same canvas",
        );
      }
    }
    const duplicate = [...this.tables.watchBotEvents.values()].find(
      (existing) =>
        existing.watch_bot_id === row.watch_bot_id &&
        existing.dedup_key === row.dedup_key &&
        existing.id !== row.id,
    );
    if (duplicate) {
      throw new DomainError(
        "conflict",
        "watch_bot_events unique (watch_bot_id, dedup_key) violated",
      );
    }
    if (row.published_at !== null) {
      const published = row.published_at.trim();
      if (published.length === 0 || Number.isNaN(Date.parse(published))) {
        throw new DomainError(
          "invalid_input",
          `invalid input syntax for type timestamp with time zone: "${row.published_at}"`,
        );
      }
    }
    this.tables.watchBotEvents.set(row.id, clone(row));
  }

  listWatchBotEvents(watchBotId: string): WatchBotEventRecord[] {
    const bot = this.tables.watchBots.get(watchBotId);
    if (
      bot &&
      !this.session.bypassRls &&
      (bot.owner_id !== this.session.ownerId ||
        this.canvasOwner(bot.canvas_id) !== this.session.ownerId)
    ) {
      return [];
    }
    return [...this.tables.watchBotEvents.values()]
      .filter((row) => row.watch_bot_id === watchBotId)
      .map((row) => clone(row));
  }

  applyOp(op: DomainWriteOp): void {
    switch (op.op) {
      case "upsert_canvas":
        this.upsertCanvas(op.row);
        return;
      case "upsert_card":
        this.upsertCard(op.row);
        return;
      case "upsert_frame":
        this.upsertFrame(op.row);
        return;
      case "upsert_column":
        this.upsertColumn(op.row);
        return;
      case "upsert_watch_bot":
        this.upsertWatchBot(op.row);
        return;
      case "insert_watch_bot_event":
        this.insertWatchBotEvent(op.row);
        return;
    }
  }

  applyTransaction(ops: DomainWriteOp[]): void {
    const snapshot = this.tables.snapshot();
    try {
      for (const op of ops) {
        this.applyOp(op);
      }
      this.assertCanvasFrameInvariants();
    } catch (error) {
      this.tables.restore(snapshot);
      throw error;
    }
  }

  private assertCanvasFrameInvariants(): void {
    for (const canvas of this.tables.canvases.values()) {
      const frames = [...this.tables.frames.values()].filter(
        (frame) => frame.canvas_id === canvas.id,
      );
      if (
        frames.length !== 1 ||
        frames[0]?.id !== canvas.primary_frame_id
      ) {
        throw new DomainError(
          "conflict",
          "Every Canvas must have exactly one primary Frame",
        );
      }
    }
  }
}
