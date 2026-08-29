import type {
  Card,
  CardProvenance,
  FirstSliceSourceType,
  WatchBot,
} from "./types";

/**
 * Shared application actions. Human UI, WatchBot, and WebMCP must use these
 * names and input shapes. No handlers live here — catalog + types only.
 *
 * Locked catalog:
 *   createWatchBot, pauseWatchBot, createCard, updateCard, setCardFrame
 */
export const ACTION_NAMES = [
  "createWatchBot",
  "pauseWatchBot",
  "createCard",
  "updateCard",
  "setCardFrame",
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

export interface CreateWatchBotInput {
  canvasId: string;
  /** Omit to default to first-slice sources (`web`, `news`). */
  sourceTypes?: FirstSliceSourceType[];
  label?: string;
}

export interface PauseWatchBotInput {
  watchBotId: string;
}

export interface CreateCardInput {
  canvasId: string;
  /** Required. Cards without provenance are invalid. */
  provenance: CardProvenance;
  body?: string;
  position?: { x: number; y: number };
}

export interface UpdateCardInput {
  cardId: string;
  /** Required on every update — provenance is not optional after create. */
  provenance: CardProvenance;
  body?: string;
  position?: { x: number; y: number };
}

/**
 * Apply Frame membership derived from spatial containment.
 * The UI (or WatchBot / WebMCP) computes whether the card is inside a Frame
 * and calls this action. Membership is not invented in the UI layer alone.
 * `frameId: null` means the card was moved outside every Frame.
 */
export interface SetCardFrameInput {
  cardId: string;
  frameId: string | null;
}

export interface ActionResultMap {
  createWatchBot: WatchBot;
  pauseWatchBot: WatchBot;
  createCard: Card;
  updateCard: Card;
  setCardFrame: Card;
}

export type JsonSchema = {
  type: "object";
  required: string[];
  additionalProperties: false;
  properties: Record<string, unknown>;
};

const provenanceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sourceUrl", "title", "publishedAt", "sourceType"],
  properties: {
    sourceUrl: { type: "string", format: "uri" },
    title: { type: "string", minLength: 1 },
    publishedAt: { type: "string", format: "date-time" },
    sourceType: { type: "string", enum: ["web", "news", "youtube", "x"] },
  },
} as const;

export interface DomainAction<N extends ActionName = ActionName> {
  name: N;
  description: string;
  inputSchema: JsonSchema;
}

export const ACTION_CATALOG: {
  [K in ActionName]: DomainAction<K>;
} = {
  createWatchBot: {
    name: "createWatchBot",
    description:
      "Create and bind a WatchBot to a Canvas. First slice sources are web and news only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId"],
      properties: {
        canvasId: { type: "string", minLength: 1 },
        sourceTypes: {
          type: "array",
          items: { type: "string", enum: ["web", "news"] },
        },
        label: { type: "string" },
      },
    },
  },
  pauseWatchBot: {
    name: "pauseWatchBot",
    description: "Pause a WatchBot. Status becomes paused; it stops discovering.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["watchBotId"],
      properties: {
        watchBotId: { type: "string", minLength: 1 },
      },
    },
  },
  createCard: {
    name: "createCard",
    description:
      "Create a Card on a Canvas. Provenance (sourceUrl, title, publishedAt, sourceType) is required.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["canvasId", "provenance"],
      properties: {
        canvasId: { type: "string", minLength: 1 },
        provenance: provenanceSchema,
        body: { type: "string" },
        position: {
          type: "object",
          additionalProperties: false,
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
        },
      },
    },
  },
  updateCard: {
    name: "updateCard",
    description:
      "Update a Card. Provenance (sourceUrl, title, publishedAt, sourceType) is required.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cardId", "provenance"],
      properties: {
        cardId: { type: "string", minLength: 1 },
        provenance: provenanceSchema,
        body: { type: "string" },
        position: {
          type: "object",
          additionalProperties: false,
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
        },
      },
    },
  },
  setCardFrame: {
    name: "setCardFrame",
    description:
      "Set a Card's Frame membership from spatial containment (inside a Frame, or null if outside all Frames). Not a UI-only field.",
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
};

export const ACTION_CATALOG_LIST: DomainAction[] = ACTION_NAMES.map(
  (name) => ACTION_CATALOG[name],
);
