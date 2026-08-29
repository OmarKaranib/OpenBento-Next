import type { Canvas, Card, Frame, WatchBot } from "./types";

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
}
