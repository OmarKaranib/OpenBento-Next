import { DomainError } from "./errors";
import type { Canvas, Card, Frame, OwnerId, WatchBot, WatchBotEvent } from "./types";

/**
 * Persistence port. Handlers depend on this, not on a vendor SDK.
 *
 * Runtime (`getDomainStore`) is `SupabaseDomainStore`. `InMemoryDomainStore`
 * is for isolated tests only — never a production/runtime fallback.
 */
export interface DomainStore {
  getCanvas(id: string): Promise<Canvas | null>;
  saveCanvas(canvas: Canvas): Promise<void>;
  /** Reload/login restore. Not an ACTION_CATALOG name. */
  listCanvasesByOwner(ownerId: OwnerId): Promise<Canvas[]>;

  getCard(id: string): Promise<Card | null>;
  saveCard(card: Card): Promise<void>;
  listCardsByCanvas(canvasId: string): Promise<Card[]>;

  getFrame(id: string): Promise<Frame | null>;
  saveFrame(frame: Frame): Promise<void>;
  listFramesByCanvas(canvasId: string): Promise<Frame[]>;

  getWatchBot(id: string): Promise<WatchBot | null>;
  saveWatchBot(watchBot: WatchBot): Promise<void>;
  listWatchBotsByCanvas(canvasId: string): Promise<WatchBot[]>;
  /** Worker scan. Not an action input; owner scoping stays in the executor. */
  listWatchBots(): Promise<WatchBot[]>;

  /**
   * Persist a WatchBotEvent. `(watchBotId, dedupKey)` is unique — the same
   * pair as `UNIQUE (watch_bot_id, dedup_key)` on watch_bot_events.
   * `cardId` must reference a Card on the same canvas (composite FK).
   */
  saveWatchBotEvent(event: WatchBotEvent): Promise<void>;
  listWatchBotEventsByWatchBot(watchBotId: string): Promise<WatchBotEvent[]>;

  /**
   * Atomic persist for leftover-Card TOCTOU: `createCard` + `setCardFrame` +
   * unique claim. A unique conflict rolls back the Card. A thrown create
   * must not occupy the unique key.
   */
  runInTransaction<T>(work: (store: DomainStore) => Promise<T>): Promise<T>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertEventCardSameCanvas(
  event: WatchBotEvent,
  card: Card | undefined,
): void {
  if (!event.cardId) {
    return;
  }
  if (!card) {
    throw new DomainError(
      "invalid_input",
      "watch_bot_events.card_id must reference a card on the same canvas",
    );
  }
  if (card.canvasId !== event.canvasId) {
    throw new DomainError(
      "invalid_input",
      "watch_bot_events.card_id must reference a card on the same canvas",
    );
  }
}

/** Isolated-test adapter. Not used by getDomainStore() at runtime. */
export class InMemoryDomainStore implements DomainStore {
  private readonly canvases = new Map<string, Canvas>();
  private readonly cards = new Map<string, Card>();
  private readonly frames = new Map<string, Frame>();
  private readonly watchBots = new Map<string, WatchBot>();
  private readonly watchBotEvents = new Map<string, WatchBotEvent>();

  async getCanvas(id: string): Promise<Canvas | null> {
    const row = this.canvases.get(id);
    return row ? clone(row) : null;
  }

  async saveCanvas(canvas: Canvas): Promise<void> {
    this.canvases.set(canvas.id, clone(canvas));
  }

  async listCanvasesByOwner(ownerId: OwnerId): Promise<Canvas[]> {
    return [...this.canvases.values()]
      .filter((canvas) => canvas.ownerId === ownerId)
      .map((canvas) => clone(canvas));
  }

  async getCard(id: string): Promise<Card | null> {
    const row = this.cards.get(id);
    return row ? clone(row) : null;
  }

  async saveCard(card: Card): Promise<void> {
    this.cards.set(card.id, clone(card));
  }

  async listCardsByCanvas(canvasId: string): Promise<Card[]> {
    return [...this.cards.values()]
      .filter((card) => card.canvasId === canvasId)
      .map((card) => clone(card));
  }

  async getFrame(id: string): Promise<Frame | null> {
    const row = this.frames.get(id);
    return row ? clone(row) : null;
  }

  async saveFrame(frame: Frame): Promise<void> {
    this.frames.set(frame.id, clone(frame));
  }

  async listFramesByCanvas(canvasId: string): Promise<Frame[]> {
    return [...this.frames.values()]
      .filter((frame) => frame.canvasId === canvasId)
      .map((frame) => clone(frame));
  }

  async getWatchBot(id: string): Promise<WatchBot | null> {
    const row = this.watchBots.get(id);
    return row ? clone(row) : null;
  }

  async saveWatchBot(watchBot: WatchBot): Promise<void> {
    this.watchBots.set(watchBot.id, clone(watchBot));
  }

  async listWatchBotsByCanvas(canvasId: string): Promise<WatchBot[]> {
    return [...this.watchBots.values()]
      .filter((watchBot) => watchBot.canvasId === canvasId)
      .map((watchBot) => clone(watchBot));
  }

  async listWatchBots(): Promise<WatchBot[]> {
    return [...this.watchBots.values()].map((watchBot) => clone(watchBot));
  }

  async saveWatchBotEvent(event: WatchBotEvent): Promise<void> {
    const card = event.cardId ? this.cards.get(event.cardId) : undefined;
    assertEventCardSameCanvas(event, card);
    const duplicate = [...this.watchBotEvents.values()].find(
      (existing) =>
        existing.watchBotId === event.watchBotId &&
        existing.dedupKey === event.dedupKey &&
        existing.id !== event.id,
    );
    if (duplicate) {
      throw new DomainError(
        "conflict",
        "watch_bot_events unique (watch_bot_id, dedup_key) violated",
      );
    }
    this.watchBotEvents.set(event.id, clone(event));
  }

  async listWatchBotEventsByWatchBot(
    watchBotId: string,
  ): Promise<WatchBotEvent[]> {
    return [...this.watchBotEvents.values()]
      .filter((event) => event.watchBotId === watchBotId)
      .map((event) => clone(event));
  }

  async runInTransaction<T>(
    work: (store: DomainStore) => Promise<T>,
  ): Promise<T> {
    const snapshot = {
      canvases: new Map(this.canvases),
      cards: new Map(this.cards),
      frames: new Map(this.frames),
      watchBots: new Map(this.watchBots),
      watchBotEvents: new Map(this.watchBotEvents),
    };
    try {
      return await work(this);
    } catch (error) {
      this.canvases.clear();
      this.cards.clear();
      this.frames.clear();
      this.watchBots.clear();
      this.watchBotEvents.clear();
      for (const [key, value] of snapshot.canvases) {
        this.canvases.set(key, value);
      }
      for (const [key, value] of snapshot.cards) {
        this.cards.set(key, value);
      }
      for (const [key, value] of snapshot.frames) {
        this.frames.set(key, value);
      }
      for (const [key, value] of snapshot.watchBots) {
        this.watchBots.set(key, value);
      }
      for (const [key, value] of snapshot.watchBotEvents) {
        this.watchBotEvents.set(key, value);
      }
      throw error;
    }
  }
}
