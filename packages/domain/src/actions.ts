import {
  PAYLOAD_SCHEMA_ONE_OF,
  typePayloadCouplingAllOf,
} from "./payloads";
import { CARD_TYPES } from "./types";
import type {
  Canvas,
  CanvasState,
  Card,
  Column,
  DiscriminatedCardContent,
  Frame,
  FrameFullscreenView,
  Point,
  Size,
  Viewport,
  WatchBot,
  WatchBotSourceType,
  WatchBotStatusView,
} from "./types";

/**
 * Full master action catalog. Human UI, WatchBot, and WebMCP share these names.
 * Handlers live in `executor.ts` and read identity from session context only.
 * `ownerId` is server-derived and must never appear on inputs.
 */
export const ACTION_NAMES = [
  "createCanvas",
  "renameCanvas",
  "switchCanvas",
  "updateCanvasViewport",
  "deleteCanvas",
  "createCard",
  "updateCard",
  "moveCard",
  "resizeCard",
  "setCardFrame",
  "deleteCard",
  "createFrame",
  "updateFrame",
  "moveFrame",
  "resizeFrame",
  "deleteFrame",
  "createColumn",
  "updateColumn",
  "moveColumn",
  "resizeColumn",
  "setCardColumn",
  "detachCardFromColumn",
  "createWatchBot",
  "updateWatchBot",
  "pauseWatchBot",
  "resumeWatchBot",
  "getCanvasState",
  "getWatchBotStatus",
  "fullscreenFrame",
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

export interface CreateCanvasInput {
  name: string;
}

export interface RenameCanvasInput {
  canvasId: string;
  name: string;
}

export interface SwitchCanvasInput {
  canvasId: string;
}

export interface UpdateCanvasViewportInput {
  canvasId: string;
  viewport: Viewport;
}

export interface DeleteCanvasInput {
  canvasId: string;
}

export interface DeleteCanvasResult {
  deletedCanvasId: string;
  nextCanvasId: string | null;
}

export type CreateCardInput = {
  canvasId: string;
  position?: Point;
  size?: Size;
} & DiscriminatedCardContent;

/** cardId plus a type/payload pair. Type and payload must be provided together. */
export type UpdateCardInput = {
  cardId: string;
} & DiscriminatedCardContent;

export interface MoveCardInput {
  cardId: string;
  position: Point;
}

export interface ResizeCardInput {
  cardId: string;
  size: Size;
}

export interface SetCardFrameInput {
  cardId: string;
  /** Smallest containing Frame, or null if outside all Frames. */
  frameId: string | null;
}

export interface DeleteCardInput {
  cardId: string;
}

export interface DeleteCardResult {
  deletedCardId: string;
}

export interface CreateFrameInput {
  canvasId: string;
  bounds: { x: number; y: number; width: number; height: number };
  name?: string;
}

export interface UpdateFrameInput {
  frameId: string;
  name?: string;
}

export interface MoveFrameInput {
  frameId: string;
  position: Point;
}

export interface ResizeFrameInput {
  frameId: string;
  size: Size;
}

export interface DeleteFrameInput {
  frameId: string;
}

export interface DeleteFrameResult {
  deletedFrameId: string;
  detachedCardIds: string[];
}

export interface CreateColumnInput {
  canvasId: string;
  name?: string;
  position?: Point;
  size?: Size;
}

export interface UpdateColumnInput {
  columnId: string;
  name: string;
}

export interface MoveColumnInput {
  columnId: string;
  position: Point;
}

export interface ResizeColumnInput {
  columnId: string;
  size: Size;
}

export interface SetCardColumnInput {
  cardId: string;
  columnId: string | null;
}

export interface DetachCardFromColumnInput {
  cardId: string;
  position: Point;
  size?: Size;
}

export interface CreateWatchBotInput {
  canvasId: string;
  /** Required natural-language monitoring instruction. */
  instruction: string;
  name?: string;
  sourceTypes?: WatchBotSourceType[];
}

export interface UpdateWatchBotInput {
  watchBotId: string;
  instruction?: string;
  name?: string;
  sourceTypes?: WatchBotSourceType[];
}

export interface PauseWatchBotInput {
  watchBotId: string;
}

export interface ResumeWatchBotInput {
  watchBotId: string;
}

export interface GetCanvasStateInput {
  canvasId: string;
}

export interface GetWatchBotStatusInput {
  watchBotId: string;
}

export interface FullscreenFrameInput {
  frameId: string;
  active: boolean;
}

export interface ActionInputMap {
  createCanvas: CreateCanvasInput;
  renameCanvas: RenameCanvasInput;
  switchCanvas: SwitchCanvasInput;
  updateCanvasViewport: UpdateCanvasViewportInput;
  deleteCanvas: DeleteCanvasInput;
  createCard: CreateCardInput;
  updateCard: UpdateCardInput;
  moveCard: MoveCardInput;
  resizeCard: ResizeCardInput;
  setCardFrame: SetCardFrameInput;
  deleteCard: DeleteCardInput;
  createFrame: CreateFrameInput;
  updateFrame: UpdateFrameInput;
  moveFrame: MoveFrameInput;
  resizeFrame: ResizeFrameInput;
  deleteFrame: DeleteFrameInput;
  createColumn: CreateColumnInput;
  updateColumn: UpdateColumnInput;
  moveColumn: MoveColumnInput;
  resizeColumn: ResizeColumnInput;
  setCardColumn: SetCardColumnInput;
  detachCardFromColumn: DetachCardFromColumnInput;
  createWatchBot: CreateWatchBotInput;
  updateWatchBot: UpdateWatchBotInput;
  pauseWatchBot: PauseWatchBotInput;
  resumeWatchBot: ResumeWatchBotInput;
  getCanvasState: GetCanvasStateInput;
  getWatchBotStatus: GetWatchBotStatusInput;
  fullscreenFrame: FullscreenFrameInput;
}

export interface ActionResultMap {
  createCanvas: Canvas;
  renameCanvas: Canvas;
  switchCanvas: Canvas;
  updateCanvasViewport: Canvas;
  deleteCanvas: DeleteCanvasResult;
  createCard: Card;
  updateCard: Card;
  moveCard: Card;
  resizeCard: Card;
  setCardFrame: Card;
  deleteCard: DeleteCardResult;
  createFrame: Frame;
  updateFrame: Frame;
  moveFrame: Frame;
  resizeFrame: Frame;
  deleteFrame: DeleteFrameResult;
  createColumn: Column;
  updateColumn: Column;
  moveColumn: Column;
  resizeColumn: Column;
  setCardColumn: Card;
  detachCardFromColumn: Card;
  createWatchBot: WatchBot;
  updateWatchBot: WatchBot;
  pauseWatchBot: WatchBot;
  resumeWatchBot: WatchBot;
  getCanvasState: CanvasState;
  getWatchBotStatus: WatchBotStatusView;
  fullscreenFrame: FrameFullscreenView;
}

export type JsonSchema = {
  type: "object";
  required: string[];
  additionalProperties: false;
  properties: Record<string, unknown>;
  allOf?: ReadonlyArray<unknown>;
};

const cardTypeSchema = {
  type: "string",
  enum: [...CARD_TYPES],
} as const;

const payloadOneOfSchema = {
  oneOf: PAYLOAD_SCHEMA_ONE_OF,
};

const typePayloadAllOf = typePayloadCouplingAllOf();

const pointSchema = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y"],
  properties: { x: { type: "number" }, y: { type: "number" } },
} as const;

const sizeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["width", "height"],
  properties: { width: { type: "number" }, height: { type: "number" } },
} as const;

const boundsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "width", "height"],
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number" },
    height: { type: "number" },
  },
} as const;

const viewportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "zoom"],
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    zoom: { type: "number" },
  },
} as const;

export interface DomainAction<N extends ActionName = ActionName> {
  name: N;
  description: string;
  inputSchema: JsonSchema;
}

export const ACTION_CATALOG: { [K in ActionName]: DomainAction<K> } = {
  createCanvas: {
    name: "createCanvas",
    description: "Create a Canvas owned by the authenticated session user.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: { name: { type: "string", minLength: 1 } },
    },
  },
  renameCanvas: {
    name: "renameCanvas",
    description: "Rename a Canvas the session user owns.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId", "name"],
      properties: {
        canvasId: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
      },
    },
  },
  switchCanvas: {
    name: "switchCanvas",
    description: "Switch the current Canvas context.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId"],
      properties: { canvasId: { type: "string", minLength: 1 } },
    },
  },
  updateCanvasViewport: {
    name: "updateCanvasViewport",
    description:
      "Persist camera (x, y, zoom) for a Canvas. First-class; zoom is camera-only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId", "viewport"],
      properties: {
        canvasId: { type: "string", minLength: 1 },
        viewport: viewportSchema,
      },
    },
  },
  deleteCanvas: {
    name: "deleteCanvas",
    description:
      "Permanently delete an owned Canvas and its database-cascaded children.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId"],
      properties: { canvasId: { type: "string", minLength: 1 } },
    },
  },
  createCard: {
    name: "createCard",
    description:
      "Create a Card as type plus typed payload. Source payloads require provenance; notes must not include it. Payload schemas are PAYLOAD_SCHEMAS.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId", "type", "payload"],
      properties: {
        canvasId: { type: "string", minLength: 1 },
        type: cardTypeSchema,
        payload: payloadOneOfSchema,
        position: pointSchema,
        size: sizeSchema,
      },
      allOf: typePayloadAllOf,
    },
  },
  updateCard: {
    name: "updateCard",
    description:
      "Replace a Card's typed payload. Requires type+payload together. Does not move or resize. Does not re-require provenance on its own.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cardId", "type", "payload"],
      properties: {
        cardId: { type: "string", minLength: 1 },
        type: cardTypeSchema,
        payload: payloadOneOfSchema,
      },
      allOf: typePayloadAllOf,
    },
  },
  moveCard: {
    name: "moveCard",
    description:
      "Move a Card in world coordinates. First-class; not folded into updateCard. Does not require provenance.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cardId", "position"],
      properties: {
        cardId: { type: "string", minLength: 1 },
        position: pointSchema,
      },
    },
  },
  resizeCard: {
    name: "resizeCard",
    description:
      "Resize a Card. First-class; not folded into updateCard. Does not require provenance.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cardId", "size"],
      properties: {
        cardId: { type: "string", minLength: 1 },
        size: sizeSchema,
      },
    },
  },
  setCardFrame: {
    name: "setCardFrame",
    description:
      "Set Frame membership from spatial containment. Smallest area wins; equal-area ties use newest createdAt. frameId is null when outside all Frames. Platform must call canSetCardFrame / assertSameCanvasMembership; do not rely on RLS alone.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cardId", "frameId"],
      properties: {
        cardId: { type: "string", minLength: 1 },
        frameId: { type: ["string", "null"] },
      },
    },
  },
  deleteCard: {
    name: "deleteCard",
    description:
      "Permanently delete an owned Card while retaining WatchBot event history.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cardId"],
      properties: { cardId: { type: "string", minLength: 1 } },
    },
  },
  createFrame: {
    name: "createFrame",
    description:
      "Compatibility action that accepts only the Canvas canonical primary Frame bounds.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId", "bounds"],
      properties: {
        canvasId: { type: "string", minLength: 1 },
        bounds: boundsSchema,
        name: { type: "string" },
      },
    },
  },
  updateFrame: {
    name: "updateFrame",
    description: "Update Frame metadata (name). Does not move or resize.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["frameId"],
      properties: {
        frameId: { type: "string", minLength: 1 },
        name: { type: "string" },
      },
    },
  },
  moveFrame: {
    name: "moveFrame",
    description: "Rejected compatibility action: primary Frame geometry is fixed.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["frameId", "position"],
      properties: {
        frameId: { type: "string", minLength: 1 },
        position: pointSchema,
      },
    },
  },
  resizeFrame: {
    name: "resizeFrame",
    description: "Rejected compatibility action: primary Frame geometry is fixed.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["frameId", "size"],
      properties: {
        frameId: { type: "string", minLength: 1 },
        size: sizeSchema,
      },
    },
  },
  deleteFrame: {
    name: "deleteFrame",
    description:
      "Detach Cards from an owned Frame, then permanently delete the Frame.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["frameId"],
      properties: { frameId: { type: "string", minLength: 1 } },
    },
  },
  createColumn: {
    name: "createColumn",
    description:
      "Create a first-class vertical Card stream in the Canvas primary Frame.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId"],
      properties: {
        canvasId: { type: "string", minLength: 1 },
        name: { type: "string" },
        position: pointSchema,
        size: sizeSchema,
      },
    },
  },
  updateColumn: {
    name: "updateColumn",
    description: "Rename a persisted Column.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["columnId", "name"],
      properties: {
        columnId: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
      },
    },
  },
  moveColumn: {
    name: "moveColumn",
    description:
      "Move a Column in world coordinates; outside the primary Frame it is parked.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["columnId", "position"],
      properties: {
        columnId: { type: "string", minLength: 1 },
        position: pointSchema,
      },
    },
  },
  resizeColumn: {
    name: "resizeColumn",
    description: "Resize a Column within logical primary-Frame size limits.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["columnId", "size"],
      properties: {
        columnId: { type: "string", minLength: 1 },
        size: sizeSchema,
      },
    },
  },
  setCardColumn: {
    name: "setCardColumn",
    description:
      "Set explicit Card Column membership after same-Canvas and primary-Frame validation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cardId", "columnId"],
      properties: {
        cardId: { type: "string", minLength: 1 },
        columnId: { type: ["string", "null"] },
      },
    },
  },
  detachCardFromColumn: {
    name: "detachCardFromColumn",
    description:
      "Detach one existing Column Card into free primary-Frame space without changing content or provenance.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cardId", "position"],
      properties: {
        cardId: { type: "string", minLength: 1 },
        position: pointSchema,
        size: sizeSchema,
      },
    },
  },
  createWatchBot: {
    name: "createWatchBot",
    description:
      "Create a WatchBot bound to a Canvas. instruction is required. ownerId is session-derived.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId", "instruction"],
      properties: {
        canvasId: { type: "string", minLength: 1 },
        instruction: { type: "string", minLength: 1 },
        name: { type: "string" },
        sourceTypes: {
          type: "array",
          items: { type: "string", enum: ["web", "news", "youtube", "x"] },
        },
      },
    },
  },
  updateWatchBot: {
    name: "updateWatchBot",
    description: "Update WatchBot instruction, name, or source configuration.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["watchBotId"],
      properties: {
        watchBotId: { type: "string", minLength: 1 },
        instruction: { type: "string", minLength: 1 },
        name: { type: "string" },
        sourceTypes: {
          type: "array",
          items: { type: "string", enum: ["web", "news", "youtube", "x"] },
        },
      },
    },
  },
  pauseWatchBot: {
    name: "pauseWatchBot",
    description: "Pause a WatchBot. Status becomes paused.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["watchBotId"],
      properties: { watchBotId: { type: "string", minLength: 1 } },
    },
  },
  resumeWatchBot: {
    name: "resumeWatchBot",
    description: "Resume a paused WatchBot. Status becomes running.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["watchBotId"],
      properties: { watchBotId: { type: "string", minLength: 1 } },
    },
  },
  getCanvasState: {
    name: "getCanvasState",
    description: "Read Canvas, Cards, Frames, and WatchBots for a Canvas.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId"],
      properties: { canvasId: { type: "string", minLength: 1 } },
    },
  },
  getWatchBotStatus: {
    name: "getWatchBotStatus",
    description: "Read WatchBot status: running, paused, or error.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["watchBotId"],
      properties: { watchBotId: { type: "string", minLength: 1 } },
    },
  },
  fullscreenFrame: {
    name: "fullscreenFrame",
    description:
      "View-only Frame presentation. Must not rewrite stored Frame or Card geometry.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["frameId", "active"],
      properties: {
        frameId: { type: "string", minLength: 1 },
        active: { type: "boolean" },
      },
    },
  },
};

export const ACTION_CATALOG_LIST: DomainAction[] = ACTION_NAMES.map(
  (name) => ACTION_CATALOG[name],
);

export function actionInputForbidsOwnerId(schema: JsonSchema): boolean {
  return !Object.prototype.hasOwnProperty.call(schema.properties, "ownerId");
}
