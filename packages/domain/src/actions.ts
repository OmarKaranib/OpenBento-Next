import type {
  Canvas,
  CanvasState,
  Card,
  CardProvenance,
  CardType,
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
 * No handlers. `ownerId` is server-derived and must never appear on inputs.
 */
export const ACTION_NAMES = [
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

export interface CreateCardInput {
  canvasId: string;
  type: CardType;
  title?: string;
  body?: string;
  position?: Point;
  size?: Size;
  /**
   * Required for source Card types. Forbidden as a fake URL on notes.
   * Not re-required by moveCard / resizeCard.
   */
  provenance?: CardProvenance;
}

export interface UpdateCardInput {
  cardId: string;
  title?: string;
  body?: string;
  provenance?: CardProvenance;
}

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

export interface ActionResultMap {
  createCanvas: Canvas;
  renameCanvas: Canvas;
  switchCanvas: Canvas;
  updateCanvasViewport: Canvas;
  createCard: Card;
  updateCard: Card;
  moveCard: Card;
  resizeCard: Card;
  setCardFrame: Card;
  createFrame: Frame;
  updateFrame: Frame;
  moveFrame: Frame;
  resizeFrame: Frame;
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
};

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

const provenanceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sourceUrl", "title", "publishedAt", "sourceType"],
  properties: {
    sourceUrl: { type: "string", format: "uri" },
    title: { type: "string", minLength: 1 },
    publishedAt: { type: "string", format: "date-time" },
    sourceType: {
      type: "string",
      enum: ["web", "news", "youtube", "x", "reddit", "instagram"],
    },
    author: { type: "string" },
    externalId: { type: "string" },
    discoveredAt: { type: "string", format: "date-time" },
    watchBotId: { type: "string" },
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
  createCard: {
    name: "createCard",
    description:
      "Create a Card. Provenance is required for source types only; notes must not invent a source URL.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId", "type"],
      properties: {
        canvasId: { type: "string", minLength: 1 },
        type: {
          type: "string",
          enum: [
            "note",
            "article",
            "web",
            "news",
            "youtube",
            "x",
            "reddit",
            "instagram",
            "ai_summary",
            "watchbot_status",
            "timeline",
            "chart",
          ],
        },
        title: { type: "string" },
        body: { type: "string" },
        position: pointSchema,
        size: sizeSchema,
        provenance: provenanceSchema,
      },
    },
  },
  updateCard: {
    name: "updateCard",
    description:
      "Update Card content. Does not move or resize. Does not re-require provenance.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cardId"],
      properties: {
        cardId: { type: "string", minLength: 1 },
        title: { type: "string" },
        body: { type: "string" },
        provenance: provenanceSchema,
      },
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
      "Set Frame membership from spatial containment. Overlapping Frames: smallest containing Frame wins. frameId is null when outside all Frames.",
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
  createFrame: {
    name: "createFrame",
    description: "Create a persisted bordered Frame region on a Canvas.",
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
    description: "Move a Frame in world coordinates.",
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
    description: "Resize a Frame. Does not enter fullscreen or rewrite Cards.",
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
