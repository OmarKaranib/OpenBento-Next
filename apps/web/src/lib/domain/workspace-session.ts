/**
 * UI session facade around Platform's server catalog path.
 *
 * Mutations go through `apps/web/src/server` `runDomainAction` /
 * `runBoundAction`. This module is a projection + undo log only — it does
 * not own persistence and does not stamp identity.
 *
 * Membership writes go through `setCardFrame` only.
 */

import type {
  ActionInputMap,
  ActionName,
  ActionResultMap,
  Canvas,
  Card,
  Frame,
  FrameFullscreenView,
  WatchBot,
} from "@openbento/domain";
import type { CatalogCall } from "./inputs";

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

export type RunDomainAction = <K extends ActionName>(
  name: K,
  input: ActionInputMap[K],
) => Promise<ActionResultMap[K]>;

export type WorkspaceSessionOptions = {
  runAction: RunDomainAction;
  resetStore: () => void | Promise<void>;
  prepare?: () => void | Promise<void>;
  seedDefaultCanvas?: boolean;
  /** Reload/login restore. Not a catalog action. */
  restoreCanvases?: () => Promise<Canvas[]>;
  /**
   * Tests that wipe an isolated InMemory store may replay the command log.
   * Durable persist must not replay creates after a no-op reset.
   */
  replayOnReset?: boolean;
};

function isMutating(name: ActionName): boolean {
  return MUTATING.has(name);
}

export class WorkspaceSession {
  private readonly runAction: RunDomainAction;
  private readonly resetStore: () => void | Promise<void>;
  private readonly options: WorkspaceSessionOptions;
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
  private bootPromise: Promise<void> | null = null;
  readonly ready: Promise<void>;
  private readonly resolveReady: () => void;

  constructor(options: WorkspaceSessionOptions) {
    this.runAction = options.runAction;
    this.resetStore = options.resetStore;
    this.options = options;
    this.snapshot = this.buildSnapshot();
    let resolveReady = (): void => undefined;
    this.ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    this.resolveReady = resolveReady;
    if (options.seedDefaultCanvas === false && !options.prepare) {
      this.resolveReady();
    }
  }

  /**
   * Start session I/O after mount. Must not run during SSR/prerender —
   * Next.js forbids calling server functions in the initial render.
   */
  start(): Promise<void> {
    if (!this.bootPromise) {
      this.bootPromise = this.boot().finally(() => this.resolveReady());
    }
    return this.bootPromise;
  }

  private async boot(): Promise<void> {
    if (this.options.prepare) {
      await this.options.prepare();
    }
    if (this.options.seedDefaultCanvas === false) {
      return;
    }
    if (this.options.restoreCanvases) {
      const canvases = await this.options.restoreCanvases();
      const preferred = pickRestoredCanvas(canvases);
      if (preferred) {
        for (const canvas of canvases) {
          this.canvases.set(canvas.id, canvas);
        }
        await this.commit(
          [{ name: "switchCanvas", input: { canvasId: preferred.id } }],
          { history: false },
        );
        return;
      }
    }
    await this.commit([{ name: "createCanvas", input: { name: "Untitled" } }], {
      history: false,
    });
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
    const result = await this.runAction(call.name, call.input);
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
    const state = await this.runAction("getCanvasState", {
      canvasId: this.currentCanvasId,
    });
    this.canvases.set(state.canvas.id, state.canvas);
    this.cards = state.cards;
    this.frames = state.frames;
    this.watchBots = state.watchBots;
  }

  private async rebuild(): Promise<void> {
    await this.resetStore();
    this.canvases.clear();
    this.currentCanvasId = null;
    this.cards = [];
    this.frames = [];
    this.watchBots = [];
    this.fullscreen = null;
    if (this.options.replayOnReset === false) {
      if (this.options.restoreCanvases) {
        for (const canvas of await this.options.restoreCanvases()) {
          this.canvases.set(canvas.id, canvas);
        }
        const preferred = pickRestoredCanvas([...this.canvases.values()]);
        this.currentCanvasId = preferred?.id ?? null;
      }
      await this.publish();
      return;
    }
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

function pickRestoredCanvas(canvases: Canvas[]): Canvas | undefined {
  if (canvases.length === 0) {
    return undefined;
  }
  return [...canvases].sort((a, b) => {
    const aOpened = a.lastOpenedAt ?? a.updatedAt;
    const bOpened = b.lastOpenedAt ?? b.updatedAt;
    return bOpened.localeCompare(aOpened);
  })[0];
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
