import {
  ACTION_CATALOG,
  ACTION_NAMES,
  type ActionInputMap,
  type ActionName,
  type ActionResultMap,
  type CreateCanvasInput,
  type CreateCardInput,
  type CreateColumnInput,
  type CreateFrameInput,
  type CreateWatchBotInput,
  type DeleteCanvasInput,
  type DeleteCanvasResult,
  type DeleteCardInput,
  type DeleteCardResult,
  type DeleteFrameInput,
  type DeleteFrameResult,
  type DetachCardFromColumnInput,
  type FullscreenFrameInput,
  type GetCanvasStateInput,
  type GetWatchBotStatusInput,
  type MoveCardInput,
  type MoveColumnInput,
  type MoveFrameInput,
  type PauseWatchBotInput,
  type RenameCanvasInput,
  type ResizeCardInput,
  type ResizeColumnInput,
  type ResizeFrameInput,
  type ResumeWatchBotInput,
  type SetCardFrameInput,
  type SetCardColumnInput,
  type SwitchCanvasInput,
  type UpdateCanvasViewportInput,
  type UpdateCardInput,
  type UpdateColumnInput,
  type UpdateFrameInput,
  type UpdateWatchBotInput,
} from "./actions";
import { cardContentOf, cardFromContent } from "./card-content";
import { DomainError } from "./errors";
import { assertSameCanvasMembership, containsRect } from "./frames";
import { matchesJsonSchema, type JsonSchemaNode } from "./payloads";
import type { DomainStore } from "./store";
import type { Canvas, Card, Column, Frame, OwnerId, WatchBot } from "./types";

export const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 } as const;
export const DEFAULT_CARD_SIZE = { width: 240, height: 160 } as const;
export const PRIMARY_FRAME_BOUNDS = {
  x: 0,
  y: 0,
  width: 1600,
  height: 900,
} as const;
export const DEFAULT_COLUMN_SIZE = { width: 320, height: 780 } as const;
export const MIN_COLUMN_SIZE = { width: 280, height: 320 } as const;
export const MAX_COLUMN_SIZE = { width: 1200, height: 900 } as const;

export interface ActionExecutorDeps {
  store: DomainStore;
  /** Session-derived identity. Never read from action input. */
  ownerId: OwnerId;
  now?: () => string;
  id?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Shared catalog executor. Human UI, WatchBot, and WebMCP call these methods.
 * Identity comes from `deps.ownerId` only.
 */
export class ActionExecutor {
  private readonly store: DomainStore;
  private readonly ownerId: OwnerId;
  private readonly now: () => string;
  private readonly id: () => string;

  constructor(deps: ActionExecutorDeps) {
    if (typeof deps.ownerId !== "string" || deps.ownerId.length === 0) {
      throw new DomainError(
        "unauthenticated",
        "Session ownerId is required; do not accept it from action input",
      );
    }
    this.store = deps.store;
    this.ownerId = deps.ownerId;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.id = deps.id ?? (() => crypto.randomUUID());
  }

  async execute<K extends ActionName>(
    name: K,
    input: ActionInputMap[K],
  ): Promise<ActionResultMap[K]> {
    if (!(ACTION_NAMES as readonly string[]).includes(name)) {
      throw new DomainError("invalid_input", `Unknown action ${String(name)}`);
    }
    const run = this[name] as (
      value: ActionInputMap[K],
    ) => Promise<ActionResultMap[K]>;
    return run.call(this, input);
  }

  async createCanvas(input: CreateCanvasInput): Promise<Canvas> {
    this.validate("createCanvas", input);
    const timestamp = this.now();
    const primaryFrameId = this.id();
    const canvas: Canvas = {
      id: this.id(),
      ownerId: this.ownerId,
      primaryFrameId,
      name: input.name,
      viewport: { ...DEFAULT_VIEWPORT },
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    };
    const frame: Frame = {
      id: primaryFrameId,
      canvasId: canvas.id,
      name: "Dashboard",
      bounds: { ...PRIMARY_FRAME_BOUNDS },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.store.runInTransaction(async () => {
      await this.store.saveCanvas(canvas);
      await this.store.saveFrame(frame);
    });
    return canvas;
  }

  async renameCanvas(input: RenameCanvasInput): Promise<Canvas> {
    this.validate("renameCanvas", input);
    const canvas = await this.requireOwnedCanvas(input.canvasId);
    const next: Canvas = {
      ...canvas,
      name: input.name,
      updatedAt: this.now(),
    };
    await this.store.saveCanvas(next);
    return next;
  }

  async switchCanvas(input: SwitchCanvasInput): Promise<Canvas> {
    this.validate("switchCanvas", input);
    const canvas = await this.requireOwnedCanvas(input.canvasId);
    const timestamp = this.now();
    const next: Canvas = {
      ...canvas,
      lastOpenedAt: timestamp,
      updatedAt: timestamp,
    };
    await this.store.saveCanvas(next);
    return next;
  }

  async updateCanvasViewport(
    input: UpdateCanvasViewportInput,
  ): Promise<Canvas> {
    this.validate("updateCanvasViewport", input);
    const canvas = await this.requireOwnedCanvas(input.canvasId);
    if (input.viewport.zoom <= 0) {
      throw new DomainError("invalid_input", "viewport.zoom must be greater than 0");
    }
    const next: Canvas = {
      ...canvas,
      viewport: { ...input.viewport },
      updatedAt: this.now(),
    };
    await this.store.saveCanvas(next);
    return next;
  }

  async deleteCanvas(input: DeleteCanvasInput): Promise<DeleteCanvasResult> {
    this.validate("deleteCanvas", input);
    await this.requireOwnedCanvas(input.canvasId);
    await this.store.deleteCanvas(input.canvasId);
    const remaining = await this.store.listCanvasesByOwner(this.ownerId);
    return {
      deletedCanvasId: input.canvasId,
      nextCanvasId: pickNextCanvas(remaining)?.id ?? null,
    };
  }

  async createCard(input: CreateCardInput): Promise<Card> {
    this.validate("createCard", input);
    const content = cardContentOf(input.type, input.payload);
    await this.requireOwnedCanvas(input.canvasId);
    const timestamp = this.now();
    const card = cardFromContent(
      {
        id: this.id(),
        canvasId: input.canvasId,
        frameId: null,
        columnId: null,
        position: input.position ?? { x: 0, y: 0 },
        size: input.size ?? { ...DEFAULT_CARD_SIZE },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      content,
    );
    await this.store.saveCard(card);
    return card;
  }

  async updateCard(input: UpdateCardInput): Promise<Card> {
    this.validate("updateCard", input);
    const content = cardContentOf(input.type, input.payload);
    const card = await this.requireOwnedCard(input.cardId);
    const next = cardFromContent(
      {
        id: card.id,
        canvasId: card.canvasId,
        frameId: card.frameId,
        columnId: card.columnId,
        position: card.position,
        size: card.size,
        zIndex: card.zIndex,
        createdAt: card.createdAt,
        updatedAt: this.now(),
      },
      content,
    );
    await this.store.saveCard(next);
    return next;
  }

  async moveCard(input: MoveCardInput): Promise<Card> {
    this.validate("moveCard", input);
    const card = await this.requireOwnedCard(input.cardId);
    const next: Card = {
      ...card,
      position: { ...input.position },
      updatedAt: this.now(),
    };
    await this.store.saveCard(next);
    return next;
  }

  async resizeCard(input: ResizeCardInput): Promise<Card> {
    this.validate("resizeCard", input);
    this.assertPositiveSize(input.size);
    const card = await this.requireOwnedCard(input.cardId);
    const next: Card = {
      ...card,
      size: { ...input.size },
      updatedAt: this.now(),
    };
    await this.store.saveCard(next);
    return next;
  }

  async setCardFrame(input: SetCardFrameInput): Promise<Card> {
    this.validate("setCardFrame", input);
    const card = await this.requireOwnedCard(input.cardId);
    const frame =
      input.frameId === null ? null : await this.store.getFrame(input.frameId);
    // Domain membership check. RLS is not a substitute.
    assertSameCanvasMembership(card, frame, input.frameId);
    if (frame) {
      await this.requireOwnedCanvas(frame.canvasId);
    }
    const next: Card = {
      ...card,
      frameId: input.frameId,
      ...(input.frameId === null ? { columnId: null } : {}),
      updatedAt: this.now(),
    };
    await this.store.saveCard(next);
    return next;
  }

  async deleteCard(input: DeleteCardInput): Promise<DeleteCardResult> {
    this.validate("deleteCard", input);
    await this.requireOwnedCard(input.cardId);
    await this.store.deleteCard(input.cardId);
    return { deletedCardId: input.cardId };
  }

  async createFrame(input: CreateFrameInput): Promise<Frame> {
    this.validate("createFrame", input);
    this.assertPositiveSize(input.bounds);
    const canvas = await this.requireOwnedCanvas(input.canvasId);
    const frames = await this.store.listFramesByCanvas(canvas.id);
    if (frames.length > 0) {
      const primary = selectPrimaryFrame(frames, canvas.primaryFrameId);
      if (!primary || frames.length !== 1) {
        throw new DomainError(
          "conflict",
          "Legacy multi-Frame Canvas requires the deterministic migration",
        );
      }
      const next: Frame = {
        ...primary,
        name: input.name ?? primary.name,
        bounds: { ...input.bounds },
        updatedAt: this.now(),
      };
      await this.store.saveFrame(next);
      return next;
    }
    const timestamp = this.now();
    const frame: Frame = {
      id: canvas.primaryFrameId,
      canvasId: input.canvasId,
      name: input.name ?? "Dashboard",
      bounds: { ...input.bounds },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.store.saveFrame(frame);
    return frame;
  }

  async updateFrame(input: UpdateFrameInput): Promise<Frame> {
    this.validate("updateFrame", input);
    const frame = await this.requireOwnedFrame(input.frameId);
    const next: Frame = {
      ...frame,
      name: input.name ?? frame.name,
      updatedAt: this.now(),
    };
    await this.store.saveFrame(next);
    return next;
  }

  async moveFrame(input: MoveFrameInput): Promise<Frame> {
    this.validate("moveFrame", input);
    const frame = await this.requireOwnedFrame(input.frameId);
    const next: Frame = {
      ...frame,
      bounds: {
        ...frame.bounds,
        x: input.position.x,
        y: input.position.y,
      },
      updatedAt: this.now(),
    };
    await this.store.saveFrame(next);
    return next;
  }

  async resizeFrame(input: ResizeFrameInput): Promise<Frame> {
    this.validate("resizeFrame", input);
    this.assertPositiveSize(input.size);
    const frame = await this.requireOwnedFrame(input.frameId);
    const next: Frame = {
      ...frame,
      bounds: {
        ...frame.bounds,
        width: input.size.width,
        height: input.size.height,
      },
      updatedAt: this.now(),
    };
    await this.store.saveFrame(next);
    return next;
  }

  async deleteFrame(input: DeleteFrameInput): Promise<DeleteFrameResult> {
    this.validate("deleteFrame", input);
    await this.requireOwnedFrame(input.frameId);
    throw new DomainError(
      "conflict",
      "The sole primary Frame cannot be deleted",
    );
  }

  async createColumn(input: CreateColumnInput): Promise<Column> {
    this.validate("createColumn", input);
    const canvas = await this.requireOwnedCanvas(input.canvasId);
    const frame = await this.requirePrimaryFrame(canvas);
    const columns = await this.store.listColumnsByCanvas(canvas.id);
    const size = input.size ?? { ...DEFAULT_COLUMN_SIZE };
    this.assertColumnSize(size);
    const position = input.position ?? {
      x: frame.bounds.x + 40 + columns.length * (DEFAULT_COLUMN_SIZE.width + 24),
      y: frame.bounds.y + 80,
    };
    const timestamp = this.now();
    const column: Column = {
      id: this.id(),
      canvasId: canvas.id,
      frameId: frame.id,
      name: input.name?.trim() || `Column ${columns.length + 1}`,
      bounds: { ...position, ...size },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.store.saveColumn(column);
    return column;
  }

  async updateColumn(input: UpdateColumnInput): Promise<Column> {
    this.validate("updateColumn", input);
    const column = await this.requireOwnedColumn(input.columnId);
    const next = { ...column, name: input.name.trim(), updatedAt: this.now() };
    await this.store.saveColumn(next);
    return next;
  }

  async moveColumn(input: MoveColumnInput): Promise<Column> {
    this.validate("moveColumn", input);
    const column = await this.requireOwnedColumn(input.columnId);
    const next = {
      ...column,
      bounds: { ...column.bounds, ...input.position },
      updatedAt: this.now(),
    };
    await this.store.saveColumn(next);
    return next;
  }

  async resizeColumn(input: ResizeColumnInput): Promise<Column> {
    this.validate("resizeColumn", input);
    const column = await this.requireOwnedColumn(input.columnId);
    const canvas = await this.requireOwnedCanvas(column.canvasId);
    await this.requirePrimaryFrame(canvas);
    this.assertColumnSize(input.size);
    const next = {
      ...column,
      bounds: { ...column.bounds, ...input.size },
      updatedAt: this.now(),
    };
    await this.store.saveColumn(next);
    return next;
  }

  async setCardColumn(input: SetCardColumnInput): Promise<Card> {
    this.validate("setCardColumn", input);
    const card = await this.requireOwnedCard(input.cardId);
    if (input.columnId === null) {
      const next = { ...card, columnId: null, updatedAt: this.now() };
      await this.store.saveCard(next);
      return next;
    }
    const column = await this.requireOwnedColumn(input.columnId);
    if (
      column.canvasId !== card.canvasId ||
      column.frameId !== card.frameId
    ) {
      throw new DomainError(
        "invalid_input",
        "Card and Column must belong to the same Canvas and primary Frame",
      );
    }
    const next = { ...card, columnId: column.id, updatedAt: this.now() };
    await this.store.saveCard(next);
    return next;
  }

  async detachCardFromColumn(input: DetachCardFromColumnInput): Promise<Card> {
    this.validate("detachCardFromColumn", input);
    const card = await this.requireOwnedCard(input.cardId);
    if (!card.columnId) {
      throw new DomainError("invalid_input", "Card is not in a Column");
    }
    const canvas = await this.requireOwnedCanvas(card.canvasId);
    const frame = await this.requirePrimaryFrame(canvas);
    const size = input.size ?? card.size;
    this.assertPositiveSize(size);
    if (
      !containsRect(frame.bounds, {
        ...input.position,
        ...size,
      })
    ) {
      throw new DomainError(
        "invalid_input",
        "Detached Card must be dropped inside the primary Frame",
      );
    }
    const next: Card = {
      ...card,
      frameId: frame.id,
      columnId: null,
      position: { ...input.position },
      size: { ...size },
      updatedAt: this.now(),
    };
    await this.store.saveCard(next);
    return next;
  }

  async createWatchBot(input: CreateWatchBotInput): Promise<WatchBot> {
    this.validate("createWatchBot", input);
    await this.requireOwnedCanvas(input.canvasId);
    return this.store.runInTransaction(async () => {
      const column = await this.createColumn({
        canvasId: input.canvasId,
        name: `${input.name?.trim() || "WatchBot"} feed`,
      });
      const timestamp = this.now();
      const watchBot: WatchBot = {
        id: this.id(),
        ownerId: this.ownerId,
        canvasId: input.canvasId,
        columnId: column.id,
        name: input.name,
        instruction: input.instruction,
        status: "running",
        sourceTypes: input.sourceTypes ? [...input.sourceTypes] : [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.store.saveWatchBot(watchBot);
      return watchBot;
    });
  }

  async updateWatchBot(input: UpdateWatchBotInput): Promise<WatchBot> {
    this.validate("updateWatchBot", input);
    const watchBot = await this.requireOwnedWatchBot(input.watchBotId);
    const next: WatchBot = {
      ...watchBot,
      instruction: input.instruction ?? watchBot.instruction,
      name: input.name ?? watchBot.name,
      sourceTypes: input.sourceTypes
        ? [...input.sourceTypes]
        : watchBot.sourceTypes,
      updatedAt: this.now(),
    };
    await this.store.saveWatchBot(next);
    return next;
  }

  async pauseWatchBot(input: PauseWatchBotInput): Promise<WatchBot> {
    this.validate("pauseWatchBot", input);
    const watchBot = await this.requireOwnedWatchBot(input.watchBotId);
    const next: WatchBot = {
      ...watchBot,
      status: "paused",
      updatedAt: this.now(),
    };
    await this.store.saveWatchBot(next);
    return next;
  }

  async resumeWatchBot(input: ResumeWatchBotInput): Promise<WatchBot> {
    this.validate("resumeWatchBot", input);
    const watchBot = await this.requireOwnedWatchBot(input.watchBotId);
    const next: WatchBot = {
      ...watchBot,
      status: "running",
      updatedAt: this.now(),
    };
    await this.store.saveWatchBot(next);
    return next;
  }

  async getCanvasState(input: GetCanvasStateInput) {
    this.validate("getCanvasState", input);
    const canvas = await this.requireOwnedCanvas(input.canvasId);
    const primaryFrame = await this.ensurePrimaryFrame(canvas);
    const [cards, columns, watchBots] = await Promise.all([
      this.store.listCardsByCanvas(canvas.id),
      this.store.listColumnsByCanvas(canvas.id),
      this.store.listWatchBotsByCanvas(canvas.id),
    ]);
    return { canvas, cards, frames: [primaryFrame], columns, watchBots };
  }

  async getWatchBotStatus(input: GetWatchBotStatusInput) {
    this.validate("getWatchBotStatus", input);
    const watchBot = await this.requireOwnedWatchBot(input.watchBotId);
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
  async fullscreenFrame(input: FullscreenFrameInput) {
    this.validate("fullscreenFrame", input);
    const frame = await this.requireOwnedFrame(input.frameId);
    return {
      frameId: frame.id,
      canvasId: frame.canvasId,
      active: input.active,
    };
  }

  private validate<K extends ActionName>(
    name: K,
    input: unknown,
  ): asserts input is ActionInputMap[K] {
    if (!isRecord(input)) {
      throw new DomainError("invalid_input", `Invalid input for ${name}`);
    }
    if (Object.prototype.hasOwnProperty.call(input, "ownerId")) {
      throw new DomainError(
        "invalid_input",
        "ownerId must not be supplied on action inputs; it is session-derived",
      );
    }
    const schema = ACTION_CATALOG[name].inputSchema;
    if (!matchesJsonSchema(schema as JsonSchemaNode, input)) {
      throw new DomainError("invalid_input", `Invalid input for ${name}`);
    }
  }

  private assertPositiveSize(size: { width: number; height: number }): void {
    if (size.width <= 0 || size.height <= 0) {
      throw new DomainError(
        "invalid_input",
        "width and height must be greater than 0",
      );
    }
  }

  private assertColumnSize(size: { width: number; height: number }): void {
    if (
      size.width < MIN_COLUMN_SIZE.width ||
      size.height < MIN_COLUMN_SIZE.height ||
      size.width > MAX_COLUMN_SIZE.width ||
      size.height > MAX_COLUMN_SIZE.height
    ) {
      throw new DomainError(
        "invalid_input",
        `Column size must be between ${MIN_COLUMN_SIZE.width}×${MIN_COLUMN_SIZE.height} and ${MAX_COLUMN_SIZE.width}×${MAX_COLUMN_SIZE.height}`,
      );
    }
  }

  private async ensurePrimaryFrame(canvas: Canvas): Promise<Frame> {
    const frames = await this.store.listFramesByCanvas(canvas.id);
    const primary = selectPrimaryFrame(frames, canvas.primaryFrameId);
    if (primary) {
      return primary;
    }
    const timestamp = this.now();
    const frame: Frame = {
      id: canvas.primaryFrameId,
      canvasId: canvas.id,
      name: "Dashboard",
      bounds: { ...PRIMARY_FRAME_BOUNDS },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.store.saveFrame(frame);
    return frame;
  }

  private async requirePrimaryFrame(canvas: Canvas): Promise<Frame> {
    const frame = await this.ensurePrimaryFrame(canvas);
    if (frame.id !== canvas.primaryFrameId) {
      throw new DomainError("conflict", "Canvas primary Frame is inconsistent");
    }
    return frame;
  }

  private async requireOwnedCanvas(canvasId: string): Promise<Canvas> {
    const canvas = await this.store.getCanvas(canvasId);
    if (!canvas || canvas.ownerId !== this.ownerId) {
      throw new DomainError("not_found", "Canvas not found");
    }
    return canvas;
  }

  private async requireOwnedCard(cardId: string): Promise<Card> {
    const card = await this.store.getCard(cardId);
    if (!card) {
      throw new DomainError("not_found", "Card not found");
    }
    await this.requireOwnedCanvas(card.canvasId);
    return card;
  }

  private async requireOwnedFrame(frameId: string): Promise<Frame> {
    const frame = await this.store.getFrame(frameId);
    if (!frame) {
      throw new DomainError("not_found", "Frame not found");
    }
    await this.requireOwnedCanvas(frame.canvasId);
    return frame;
  }

  private async requireOwnedWatchBot(watchBotId: string): Promise<WatchBot> {
    const watchBot = await this.store.getWatchBot(watchBotId);
    if (!watchBot || watchBot.ownerId !== this.ownerId) {
      throw new DomainError("not_found", "WatchBot not found");
    }
    await this.requireOwnedCanvas(watchBot.canvasId);
    return watchBot;
  }


  private async requireOwnedColumn(columnId: string): Promise<Column> {
    const column = await this.store.getColumn(columnId);
    if (!column) {
      throw new DomainError("not_found", "Column not found");
    }
    const canvas = await this.requireOwnedCanvas(column.canvasId);
    if (column.frameId !== canvas.primaryFrameId) {
      throw new DomainError(
        "invalid_input",
        "Column must belong to the Canvas primary Frame",
      );
    }
    return column;
  }
}

/** Deterministic legacy selection: declared primary, otherwise oldest then id. */
export function selectPrimaryFrame(
  frames: readonly Frame[],
  primaryFrameId?: string,
): Frame | undefined {
  return (
    frames.find((frame) => frame.id === primaryFrameId) ??
    [...frames].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )[0]
  );
}

function pickNextCanvas(canvases: Canvas[]): Canvas | undefined {
  return [...canvases].sort((a, b) => {
    const aOpened = a.lastOpenedAt ?? a.updatedAt;
    const bOpened = b.lastOpenedAt ?? b.updatedAt;
    return bOpened.localeCompare(aOpened) || a.id.localeCompare(b.id);
  })[0];
}

export function createActionExecutor(deps: ActionExecutorDeps): ActionExecutor {
  return new ActionExecutor(deps);
}
