import { DomainError } from "./errors";
import type { Canvas, Card, Frame, WatchBot, WatchBotEvent } from "./types";

/**
 * Persistence port. Handlers depend on this, not on Supabase or any provider.
 * Tests use `InMemoryDomainStore`. A later local Supabase adapter can implement
 * the same methods. Do not hard-wire Grok or any search/LLM vendor here.
 */
export interface DomainStore {
  getCanvas(id: string): Promise<Canvas | null>;
  saveCanvas(canvas: Canvas): Promise<void>;

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
   */
  saveWatchBotEvent(event: WatchBotEvent): Promise<void>;
  listWatchBotEventsByWatchBot(watchBotId: string): Promise<WatchBotEvent[]>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** In-memory adapter for unit tests and local/dev until a Supabase store lands. */
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
}
