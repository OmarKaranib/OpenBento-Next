/**
 * TEMPORARY in-memory adapter.
 *
 * Platform handlers do not exist yet. This client executes the same
 * `@openbento/domain` action names and input/result types — including
 * `PAYLOAD_SCHEMAS` / `isValidCardPayload`, `canSetCardFrame`, and
 * `assertSameCanvasMembership`.
 *
 * Do not treat this as a parallel UI API. Replace with Platform session
 * handlers when they land. Do not persist to Supabase/Railway from here.
 */

import {
  ACTION_CATALOG,
  WATCHBOT_SOURCE_TYPES,
  assertSameCanvasMembership,
  isValidCardPayload,
  matchesJsonSchema,
  type ActionName,
  type Canvas,
  type CanvasState,
  type Card,
  type Frame,
  type FrameFullscreenView,
  type WatchBot,
  type WatchBotStatusView,
} from "@openbento/domain";
import type { ActionInputByName, CatalogCall, CatalogResult } from "./inputs";

/** Temporary local identity. Never accepted on action inputs. */
export const LOCAL_SESSION_OWNER_ID = "local-session";

const DEFAULT_NOTE_SIZE = { width: 240, height: 160 };
const DEFAULT_CARD_SIZE = { width: 280, height: 180 };

export class DomainActionError extends Error {
  readonly action: ActionName;

  constructor(action: ActionName, message: string) {
    super(message);
    this.name = "DomainActionError";
    this.action = action;
  }
}

export type SessionSnapshot = {
  canvases: Canvas[];
  currentCanvasId: string | null;
  cards: Card[];
  frames: Frame[];
  watchBots: WatchBot[];
  fullscreen: FrameFullscreenView | null;
  canUndo: boolean;
  canRedo: boolean;
  revision: number;
};

type StoreData = {
  canvases: Map<string, Canvas>;
  cards: Map<string, Card>;
  frames: Map<string, Frame>;
  watchBots: Map<string, WatchBot>;
  currentCanvasId: string | null;
  fullscreen: FrameFullscreenView | null;
};

type HistoryRecord = {
  before: StoreData;
  calls: CatalogCall[];
};

const UNDOABLE = new Set<ActionName>([
  "createCanvas",
  "renameCanvas",
  "createCard",
  "updateCard",
  "moveCard",
  "resizeCard",
  "setCardFrame",
  "createFrame",
  "updateFrame",
  "moveFrame",
  "resizeFrame",
  "createWatchBot",
  "updateWatchBot",
  "pauseWatchBot",
  "resumeWatchBot",
]);

export type ExecuteOptions = {
  /** When false, the call is not recorded for undo (camera, reads, views). */
  history?: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

function cloneStore(data: StoreData): StoreData {
  return {
    canvases: new Map(
      [...data.canvases.entries()].map(([id, value]) => [
        id,
        structuredClone(value),
      ]),
    ),
    cards: new Map(
      [...data.cards.entries()].map(([id, value]) => [
        id,
        structuredClone(value),
      ]),
    ),
    frames: new Map(
      [...data.frames.entries()].map(([id, value]) => [
        id,
        structuredClone(value),
      ]),
    ),
    watchBots: new Map(
      [...data.watchBots.entries()].map(([id, value]) => [
        id,
        structuredClone(value),
      ]),
    ),
    currentCanvasId: data.currentCanvasId,
    fullscreen: data.fullscreen ? structuredClone(data.fullscreen) : null,
  };
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} must be non-empty`);
  }
  return trimmed;
}

function validateCatalogInput<N extends ActionName>(
  name: N,
  input: ActionInputByName[N],
): void {
  const schema = ACTION_CATALOG[name].inputSchema;
  // Domain `allOf` uses if/then coupling. The shared matcher does not
  // implement if/then; payload pairing is enforced via isValidCardPayload.
  const objectSchema = {
    type: schema.type,
    required: schema.required,
    additionalProperties: schema.additionalProperties,
    properties: schema.properties,
  };
  if (
    !matchesJsonSchema(
      objectSchema as Parameters<typeof matchesJsonSchema>[0],
      input,
    )
  ) {
    throw new DomainActionError(name, `Invalid input for ${name}`);
  }
}

export class InMemoryDomainAdapter {
  private store: StoreData = {
    canvases: new Map(),
    cards: new Map(),
    frames: new Map(),
    watchBots: new Map(),
    currentCanvasId: null,
    fullscreen: null,
  };
  private past: HistoryRecord[] = [];
  private future: HistoryRecord[] = [];
  private listeners = new Set<() => void>();
  private snapshot: SessionSnapshot;
  private revision = 0;

  constructor(options?: { seedDefaultCanvas?: boolean }) {
    this.snapshot = this.buildSnapshot();
    if (options?.seedDefaultCanvas !== false) {
      this.execute("createCanvas", { name: "Untitled" }, { history: false });
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SessionSnapshot => this.snapshot;

  getCanvasStateFor(canvasId: string): CanvasState {
    return this.buildCanvasState(canvasId);
  }

  execute<N extends ActionName>(
    name: N,
    input: ActionInputByName[N],
    options?: ExecuteOptions,
  ): CatalogResult<N> {
    const [result] = this.commit([{ name, input } as CatalogCall], options);
    return result as CatalogResult<N>;
  }

  commit(
    calls: CatalogCall[],
    options?: ExecuteOptions,
  ): unknown[] {
    if (calls.length === 0) {
      return [];
    }
    const recordHistory = options?.history !== false;
    const undoable = recordHistory && calls.some((call) => UNDOABLE.has(call.name));
    const before = undoable ? cloneStore(this.store) : null;
    const results: unknown[] = [];
    try {
      for (const call of calls) {
        results.push(this.apply(call.name, call.input));
      }
    } catch (error) {
      if (before) {
        this.store = before;
      }
      throw error;
    }
    if (before) {
      this.past.push({ before, calls });
      this.future = [];
    }
    this.publish();
    return results;
  }

  undo(): boolean {
    const entry = this.past.pop();
    if (!entry) {
      return false;
    }
    this.store = cloneStore(entry.before);
    this.future.push(entry);
    this.publish();
    return true;
  }

  /**
   * Redo by replaying the recorded domain actions, not catalog metadata.
   */
  redo(): boolean {
    const entry = this.future.pop();
    if (!entry) {
      return false;
    }
    const before = cloneStore(this.store);
    for (const call of entry.calls) {
      this.apply(call.name, call.input);
    }
    this.past.push({ before, calls: entry.calls });
    this.publish();
    return true;
  }

  private apply<N extends ActionName>(
    name: N,
    input: ActionInputByName[N],
  ): CatalogResult<N> {
    validateCatalogInput(name, input);
    const result = this.dispatch(name, input);
    return result;
  }

  private dispatch<N extends ActionName>(
    name: N,
    input: ActionInputByName[N],
  ): CatalogResult<N> {
    switch (name) {
      case "createCanvas":
        return this.createCanvas(
          input as ActionInputByName["createCanvas"],
        ) as CatalogResult<N>;
      case "renameCanvas":
        return this.renameCanvas(
          input as ActionInputByName["renameCanvas"],
        ) as CatalogResult<N>;
      case "switchCanvas":
        return this.switchCanvas(
          input as ActionInputByName["switchCanvas"],
        ) as CatalogResult<N>;
      case "updateCanvasViewport":
        return this.updateCanvasViewport(
          input as ActionInputByName["updateCanvasViewport"],
        ) as CatalogResult<N>;
      case "createCard":
        return this.createCard(
          input as ActionInputByName["createCard"],
        ) as CatalogResult<N>;
      case "updateCard":
        return this.updateCard(
          input as ActionInputByName["updateCard"],
        ) as CatalogResult<N>;
      case "moveCard":
        return this.moveCard(
          input as ActionInputByName["moveCard"],
        ) as CatalogResult<N>;
      case "resizeCard":
        return this.resizeCard(
          input as ActionInputByName["resizeCard"],
        ) as CatalogResult<N>;
      case "setCardFrame":
        return this.setCardFrame(
          input as ActionInputByName["setCardFrame"],
        ) as CatalogResult<N>;
      case "createFrame":
        return this.createFrame(
          input as ActionInputByName["createFrame"],
        ) as CatalogResult<N>;
      case "updateFrame":
        return this.updateFrame(
          input as ActionInputByName["updateFrame"],
        ) as CatalogResult<N>;
      case "moveFrame":
        return this.moveFrame(
          input as ActionInputByName["moveFrame"],
        ) as CatalogResult<N>;
      case "resizeFrame":
        return this.resizeFrame(
          input as ActionInputByName["resizeFrame"],
        ) as CatalogResult<N>;
      case "createWatchBot":
        return this.createWatchBot(
          input as ActionInputByName["createWatchBot"],
        ) as CatalogResult<N>;
      case "updateWatchBot":
        return this.updateWatchBot(
          input as ActionInputByName["updateWatchBot"],
        ) as CatalogResult<N>;
      case "pauseWatchBot":
        return this.pauseWatchBot(
          input as ActionInputByName["pauseWatchBot"],
        ) as CatalogResult<N>;
      case "resumeWatchBot":
        return this.resumeWatchBot(
          input as ActionInputByName["resumeWatchBot"],
        ) as CatalogResult<N>;
      case "getCanvasState":
        return this.getCanvasState(
          input as ActionInputByName["getCanvasState"],
        ) as CatalogResult<N>;
      case "getWatchBotStatus":
        return this.getWatchBotStatus(
          input as ActionInputByName["getWatchBotStatus"],
        ) as CatalogResult<N>;
      case "fullscreenFrame":
        return this.fullscreenFrame(
          input as ActionInputByName["fullscreenFrame"],
        ) as CatalogResult<N>;
      default: {
        const _never: never = name;
        throw new DomainActionError(_never, `Unknown action ${String(_never)}`);
      }
    }
  }

  private createCanvas(input: ActionInputByName["createCanvas"]): Canvas {
    const stamp = nowIso();
    const canvas: Canvas = {
      id: newId("cvn"),
      ownerId: LOCAL_SESSION_OWNER_ID,
      name: requireNonEmpty(input.name, "name"),
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: stamp,
      updatedAt: stamp,
      lastOpenedAt: stamp,
    };
    this.store.canvases.set(canvas.id, canvas);
    this.store.currentCanvasId = canvas.id;
    return canvas;
  }

  private renameCanvas(input: ActionInputByName["renameCanvas"]): Canvas {
    const canvas = this.requireCanvas(input.canvasId, "renameCanvas");
    const next: Canvas = {
      ...canvas,
      name: requireNonEmpty(input.name, "name"),
      updatedAt: nowIso(),
    };
    this.store.canvases.set(next.id, next);
    return next;
  }

  private switchCanvas(input: ActionInputByName["switchCanvas"]): Canvas {
    const canvas = this.requireCanvas(input.canvasId, "switchCanvas");
    const next: Canvas = {
      ...canvas,
      lastOpenedAt: nowIso(),
      updatedAt: canvas.updatedAt,
    };
    this.store.canvases.set(next.id, next);
    this.store.currentCanvasId = next.id;
    this.store.fullscreen = null;
    return next;
  }

  private updateCanvasViewport(
    input: ActionInputByName["updateCanvasViewport"],
  ): Canvas {
    const canvas = this.requireCanvas(input.canvasId, "updateCanvasViewport");
    const next: Canvas = {
      ...canvas,
      viewport: { ...input.viewport },
      updatedAt: nowIso(),
    };
    this.store.canvases.set(next.id, next);
    return next;
  }

  private createCard(input: ActionInputByName["createCard"]): Card {
    this.requireCanvas(input.canvasId, "createCard");
    if (!isValidCardPayload(input.type, input.payload)) {
      throw new DomainActionError(
        "createCard",
        `Payload does not match PAYLOAD_SCHEMAS for type ${input.type}`,
      );
    }
    const stamp = nowIso();
    const size =
      input.size ??
      (input.type === "note" ? DEFAULT_NOTE_SIZE : DEFAULT_CARD_SIZE);
    const card = {
      id: newId("crd"),
      canvasId: input.canvasId,
      frameId: null,
      type: input.type,
      payload: input.payload,
      position: input.position ?? { x: 120, y: 120 },
      size,
      zIndex: this.nextCardZ(input.canvasId),
      createdAt: stamp,
      updatedAt: stamp,
    } as Card;
    this.store.cards.set(card.id, card);
    return card;
  }

  private updateCard(input: ActionInputByName["updateCard"]): Card {
    const card = this.requireCard(input.cardId, "updateCard");
    if (!isValidCardPayload(input.type, input.payload)) {
      throw new DomainActionError(
        "updateCard",
        `Payload does not match PAYLOAD_SCHEMAS for type ${input.type}`,
      );
    }
    const next = {
      ...card,
      type: input.type,
      payload: input.payload,
      updatedAt: nowIso(),
    } as Card;
    this.store.cards.set(next.id, next);
    return next;
  }

  private moveCard(input: ActionInputByName["moveCard"]): Card {
    const card = this.requireCard(input.cardId, "moveCard");
    const next: Card = {
      ...card,
      position: { ...input.position },
      updatedAt: nowIso(),
    };
    this.store.cards.set(next.id, next);
    return next;
  }

  private resizeCard(input: ActionInputByName["resizeCard"]): Card {
    const card = this.requireCard(input.cardId, "resizeCard");
    const next: Card = {
      ...card,
      size: { ...input.size },
      updatedAt: nowIso(),
    };
    this.store.cards.set(next.id, next);
    return next;
  }

  private setCardFrame(input: ActionInputByName["setCardFrame"]): Card {
    const card = this.requireCard(input.cardId, "setCardFrame");
    const frame =
      input.frameId === null
        ? null
        : this.requireFrame(input.frameId, "setCardFrame");
    assertSameCanvasMembership(card, frame, input.frameId);
    const next: Card = {
      ...card,
      frameId: input.frameId,
      updatedAt: nowIso(),
    };
    this.store.cards.set(next.id, next);
    return next;
  }

  private createFrame(input: ActionInputByName["createFrame"]): Frame {
    this.requireCanvas(input.canvasId, "createFrame");
    const stamp = nowIso();
    const frame: Frame = {
      id: newId("frm"),
      canvasId: input.canvasId,
      name: input.name?.trim() ? input.name.trim() : "Frame",
      bounds: { ...input.bounds },
      zIndex: 0,
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.store.frames.set(frame.id, frame);
    return frame;
  }

  private updateFrame(input: ActionInputByName["updateFrame"]): Frame {
    const frame = this.requireFrame(input.frameId, "updateFrame");
    const next: Frame = {
      ...frame,
      name:
        input.name === undefined
          ? frame.name
          : requireNonEmpty(input.name, "name"),
      updatedAt: nowIso(),
    };
    this.store.frames.set(next.id, next);
    return next;
  }

  private moveFrame(input: ActionInputByName["moveFrame"]): Frame {
    const frame = this.requireFrame(input.frameId, "moveFrame");
    const next: Frame = {
      ...frame,
      bounds: {
        ...frame.bounds,
        x: input.position.x,
        y: input.position.y,
      },
      updatedAt: nowIso(),
    };
    this.store.frames.set(next.id, next);
    return next;
  }

  private resizeFrame(input: ActionInputByName["resizeFrame"]): Frame {
    const frame = this.requireFrame(input.frameId, "resizeFrame");
    const next: Frame = {
      ...frame,
      bounds: {
        ...frame.bounds,
        width: input.size.width,
        height: input.size.height,
      },
      updatedAt: nowIso(),
    };
    this.store.frames.set(next.id, next);
    return next;
  }

  private createWatchBot(input: ActionInputByName["createWatchBot"]): WatchBot {
    this.requireCanvas(input.canvasId, "createWatchBot");
    const stamp = nowIso();
    const watchBot: WatchBot = {
      id: newId("wbt"),
      ownerId: LOCAL_SESSION_OWNER_ID,
      canvasId: input.canvasId,
      name: input.name?.trim() || undefined,
      instruction: requireNonEmpty(input.instruction, "instruction"),
      status: "running",
      sourceTypes: input.sourceTypes ?? [...WATCHBOT_SOURCE_TYPES],
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.store.watchBots.set(watchBot.id, watchBot);
    return watchBot;
  }

  private updateWatchBot(input: ActionInputByName["updateWatchBot"]): WatchBot {
    const watchBot = this.requireWatchBot(input.watchBotId, "updateWatchBot");
    const next: WatchBot = {
      ...watchBot,
      instruction:
        input.instruction === undefined
          ? watchBot.instruction
          : requireNonEmpty(input.instruction, "instruction"),
      name: input.name === undefined ? watchBot.name : input.name.trim() || undefined,
      sourceTypes: input.sourceTypes ?? watchBot.sourceTypes,
      updatedAt: nowIso(),
    };
    this.store.watchBots.set(next.id, next);
    return next;
  }

  private pauseWatchBot(input: ActionInputByName["pauseWatchBot"]): WatchBot {
    const watchBot = this.requireWatchBot(input.watchBotId, "pauseWatchBot");
    const next: WatchBot = {
      ...watchBot,
      status: "paused",
      updatedAt: nowIso(),
    };
    this.store.watchBots.set(next.id, next);
    return next;
  }

  private resumeWatchBot(input: ActionInputByName["resumeWatchBot"]): WatchBot {
    const watchBot = this.requireWatchBot(input.watchBotId, "resumeWatchBot");
    const next: WatchBot = {
      ...watchBot,
      status: "running",
      lastError: undefined,
      updatedAt: nowIso(),
    };
    this.store.watchBots.set(next.id, next);
    return next;
  }

  private getCanvasState(
    input: ActionInputByName["getCanvasState"],
  ): CanvasState {
    return this.buildCanvasState(input.canvasId);
  }

  private getWatchBotStatus(
    input: ActionInputByName["getWatchBotStatus"],
  ): WatchBotStatusView {
    const watchBot = this.requireWatchBot(
      input.watchBotId,
      "getWatchBotStatus",
    );
    return {
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      status: watchBot.status,
      lastActivityAt: watchBot.lastActivityAt,
      lastError: watchBot.lastError,
    };
  }

  /**
   * View-only. Must not rewrite stored Frame or Card geometry.
   */
  private fullscreenFrame(
    input: ActionInputByName["fullscreenFrame"],
  ): FrameFullscreenView {
    const frame = this.requireFrame(input.frameId, "fullscreenFrame");
    const view: FrameFullscreenView = {
      frameId: frame.id,
      canvasId: frame.canvasId,
      active: input.active,
    };
    this.store.fullscreen = input.active ? view : null;
    return view;
  }

  private buildCanvasState(canvasId: string): CanvasState {
    const canvas = this.requireCanvas(canvasId, "getCanvasState");
    return {
      canvas,
      cards: [...this.store.cards.values()].filter(
        (card) => card.canvasId === canvasId,
      ),
      frames: [...this.store.frames.values()].filter(
        (frame) => frame.canvasId === canvasId,
      ),
      watchBots: [...this.store.watchBots.values()].filter(
        (bot) => bot.canvasId === canvasId,
      ),
    };
  }

  private nextCardZ(canvasId: string): number {
    let max = 0;
    for (const card of this.store.cards.values()) {
      if (card.canvasId === canvasId) {
        max = Math.max(max, card.zIndex ?? 0);
      }
    }
    return max + 1;
  }

  private requireCanvas(id: string, action: ActionName): Canvas {
    const canvas = this.store.canvases.get(id);
    if (!canvas) {
      throw new DomainActionError(action, `Canvas not found: ${id}`);
    }
    return canvas;
  }

  private requireCard(id: string, action: ActionName): Card {
    const card = this.store.cards.get(id);
    if (!card) {
      throw new DomainActionError(action, `Card not found: ${id}`);
    }
    return card;
  }

  private requireFrame(id: string, action: ActionName): Frame {
    const frame = this.store.frames.get(id);
    if (!frame) {
      throw new DomainActionError(action, `Frame not found: ${id}`);
    }
    return frame;
  }

  private requireWatchBot(id: string, action: ActionName): WatchBot {
    const watchBot = this.store.watchBots.get(id);
    if (!watchBot) {
      throw new DomainActionError(action, `WatchBot not found: ${id}`);
    }
    return watchBot;
  }

  private buildSnapshot(): SessionSnapshot {
    const currentCanvasId = this.store.currentCanvasId;
    const cards = currentCanvasId
      ? [...this.store.cards.values()].filter((c) => c.canvasId === currentCanvasId)
      : [];
    const frames = currentCanvasId
      ? [...this.store.frames.values()].filter(
          (f) => f.canvasId === currentCanvasId,
        )
      : [];
    const watchBots = currentCanvasId
      ? [...this.store.watchBots.values()].filter(
          (b) => b.canvasId === currentCanvasId,
        )
      : [];
    return {
      canvases: [...this.store.canvases.values()].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
      currentCanvasId,
      cards,
      frames,
      watchBots,
      fullscreen: this.store.fullscreen,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
      revision: this.revision,
    };
  }

  private publish(): void {
    this.revision += 1;
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }
}
