/**
 * UI session around Platform's shared executor.
 *
 * Import path (PR #4 / bot/platform):
 *   createActionExecutor, InMemoryDomainStore ← `@openbento/domain`
 *   packages/domain/src/executor.ts
 *   packages/domain/src/store.ts
 *
 * Do not reimplement InMemoryDomainStore or a parallel action catalog here.
 * Membership writes go through `setCardFrame` only.
 */

import {
  createActionExecutor,
  InMemoryDomainStore,
  type ActionInputMap,
  type ActionName,
  type ActionResultMap,
  type Canvas,
  type Card,
  type DomainStore,
  type Frame,
  type FrameFullscreenView,
  type WatchBot,
} from "@openbento/domain";
import type { CatalogCall } from "./inputs";

/** Temporary until Platform session auth. Never sent on action inputs. */
export const LOCAL_SESSION_OWNER_ID = "local-session";

const MUTATING = new Set<ActionName>([
  "createCanvas",
  "renameCanvas",
  "switchCanvas",
  "updateCanvasViewport",
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

export type ExecuteOptions = {
  history?: boolean;
};

class IdSequence {
  private values: string[] = [];
  private index = 0;

  next = (): string => {
    const existing = this.values[this.index];
    if (existing !== undefined) {
      this.index += 1;
      return existing;
    }
    const id = crypto.randomUUID();
    this.values.push(id);
    this.index += 1;
    return id;
  };

  rewind(): void {
    this.index = 0;
  }
}

function isMutating(name: ActionName): boolean {
  return MUTATING.has(name);
}

export class WorkspaceSession {
  private ids = new IdSequence();
  private store: DomainStore;
  private executor: ReturnType<typeof createActionExecutor>;
  private canvases = new Map<string, Canvas>();
  private currentCanvasId: string | null = null;
  private cards: Card[] = [];
  private frames: Frame[] = [];
  private watchBots: WatchBot[] = [];
  private fullscreen: FrameFullscreenView | null = null;
  private fullLog: CatalogCall[] = [];
  private past: CatalogCall[][] = [];
  private future: CatalogCall[][] = [];
  private listeners = new Set<() => void>();
  private snapshot: SessionSnapshot;
  private revision = 0;
  readonly ready: Promise<void>;

  constructor(options?: { seedDefaultCanvas?: boolean; store?: DomainStore }) {
    this.store = options?.store ?? new InMemoryDomainStore();
    this.executor = createActionExecutor({
      store: this.store,
      ownerId: LOCAL_SESSION_OWNER_ID,
      id: this.ids.next,
    });
    this.snapshot = this.buildSnapshot();
    this.ready =
      options?.seedDefaultCanvas === false
        ? Promise.resolve()
        : this.commit(
            [{ name: "createCanvas", input: { name: "Untitled" } }],
            { history: false },
          ).then(() => undefined);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SessionSnapshot => this.snapshot;

  async execute<N extends ActionName>(
    name: N,
    input: ActionInputMap[N],
    options?: ExecuteOptions,
  ): Promise<ActionResultMap[N]> {
    const [result] = await this.commit(
      [{ name, input } as CatalogCall],
      options,
    );
    return result as ActionResultMap[N];
  }

  async commit(
    calls: CatalogCall[],
    options?: ExecuteOptions,
  ): Promise<unknown[]> {
    if (calls.length === 0) {
      return [];
    }
    const recordHistory =
      options?.history !== false && calls.some((call) => UNDOABLE.has(call.name));
    const results: unknown[] = [];
    for (const call of calls) {
      results.push(await this.apply(call));
      if (isMutating(call.name)) {
        this.fullLog.push(call);
      }
    }
    if (recordHistory) {
      this.past.push(calls.filter((call) => UNDOABLE.has(call.name)));
      this.future = [];
    }
    await this.publish();
    return results;
  }

  async undo(): Promise<boolean> {
    const batch = this.past.pop();
    if (!batch || batch.length === 0) {
      return false;
    }
    this.fullLog = removeLastBatch(this.fullLog, batch);
    this.future.push(batch);
    await this.rebuild();
    return true;
  }

  async redo(): Promise<boolean> {
    const batch = this.future.pop();
    if (!batch || batch.length === 0) {
      return false;
    }
    for (const call of batch) {
      await this.apply(call);
      if (isMutating(call.name)) {
        this.fullLog.push(call);
      }
    }
    this.past.push(batch);
    await this.publish();
    return true;
  }

  private async apply(call: CatalogCall): Promise<unknown> {
    const result = await this.executor.execute(call.name, call.input);
    this.project(call.name, result);
    return result;
  }

  private project(name: ActionName, result: unknown): void {
    if (
      name === "createCanvas" ||
      name === "renameCanvas" ||
      name === "switchCanvas" ||
      name === "updateCanvasViewport"
    ) {
      const canvas = result as Canvas;
      this.canvases.set(canvas.id, canvas);
      if (name === "createCanvas" || name === "switchCanvas") {
        this.currentCanvasId = canvas.id;
        this.fullscreen = null;
      }
    }
    if (name === "fullscreenFrame") {
      const view = result as FrameFullscreenView;
      this.fullscreen = view.active ? view : null;
      return;
    }
  }

  private async refreshCurrentCanvas(): Promise<void> {
    if (!this.currentCanvasId) {
      this.cards = [];
      this.frames = [];
      this.watchBots = [];
      return;
    }
    const state = await this.executor.execute("getCanvasState", {
      canvasId: this.currentCanvasId,
    });
    this.canvases.set(state.canvas.id, state.canvas);
    this.cards = state.cards;
    this.frames = state.frames;
    this.watchBots = state.watchBots;
  }

  private async rebuild(): Promise<void> {
    this.ids.rewind();
    this.store = new InMemoryDomainStore();
    this.executor = createActionExecutor({
      store: this.store,
      ownerId: LOCAL_SESSION_OWNER_ID,
      id: this.ids.next,
    });
    this.canvases.clear();
    this.currentCanvasId = null;
    this.cards = [];
    this.frames = [];
    this.watchBots = [];
    this.fullscreen = null;
    for (const call of this.fullLog) {
      await this.apply(call);
    }
    await this.publish();
  }

  private buildSnapshot(): SessionSnapshot {
    return {
      canvases: [...this.canvases.values()].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
      currentCanvasId: this.currentCanvasId,
      cards: this.cards,
      frames: this.frames,
      watchBots: this.watchBots,
      fullscreen: this.fullscreen,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
      revision: this.revision,
    };
  }

  private async publish(): Promise<void> {
    await this.refreshCurrentCanvas();
    this.revision += 1;
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function removeLastBatch(
  log: CatalogCall[],
  batch: CatalogCall[],
): CatalogCall[] {
  const next = [...log];
  for (let i = batch.length - 1; i >= 0; i -= 1) {
    const target = batch[i];
    for (let j = next.length - 1; j >= 0; j -= 1) {
      if (next[j] === target) {
        next.splice(j, 1);
        break;
      }
    }
  }
  return next;
}
