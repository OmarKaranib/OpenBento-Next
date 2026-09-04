/**
 * Shared runtime payload schemas.
 *
 * Human UI, Platform server, WatchBot, and WebMCP must use these schemas.
 * Do not invent a second payload validator in those layers.
 */

import {
  CARD_TYPES,
  SOURCE_CARD_TYPES,
  SOURCE_TYPES,
  type CardPayloadByType,
  type CardProvenance,
  type CardType,
  type NotePayload,
  type SourceCardPayload,
  type StockChartPayload,
  type XCardPayload,
} from "./types";

export type JsonSchemaNode = {
  type?:
    | "object"
    | "string"
    | "number"
    | "boolean"
    | "array"
    | "null"
    | ReadonlyArray<
        "object" | "string" | "number" | "boolean" | "array" | "null"
      >;
  required?: readonly string[];
  additionalProperties?: boolean;
  properties?: Record<string, JsonSchemaNode>;
  enum?: readonly unknown[];
  const?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maxItems?: number;
  items?: JsonSchemaNode;
  oneOf?: readonly JsonSchemaNode[];
  anyOf?: readonly JsonSchemaNode[];
  allOf?: readonly JsonSchemaNode[];
};

export type ObjectJsonSchema = JsonSchemaNode & {
  type: "object";
  required: readonly string[];
  additionalProperties: false;
  properties: Record<string, JsonSchemaNode>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Source URLs cross the WebMCP, WatchBot, and UI trust boundaries. Accept only
 * navigable public http(s) URLs; display code independently sanitizes them.
 */
export function isSafeSourceUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

function valueMatchesType(
  type: "object" | "string" | "number" | "boolean" | "array" | "null",
  value: unknown,
): boolean {
  switch (type) {
    case "object":
      return isRecord(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
  }
}

/** Minimal JSON Schema matcher for the domain schema subset. */
export function matchesJsonSchema(
  schema: JsonSchemaNode,
  value: unknown,
): boolean {
  if (schema.oneOf) {
    return (
      schema.oneOf.filter((entry) => matchesJsonSchema(entry, value)).length ===
      1
    );
  }
  if (schema.anyOf) {
    return schema.anyOf.some((entry) => matchesJsonSchema(entry, value));
  }
  if (schema.allOf) {
    return schema.allOf.every((entry) => matchesJsonSchema(entry, value));
  }
  if (schema.const !== undefined && !Object.is(schema.const, value)) {
    return false;
  }
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    return false;
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => valueMatchesType(type, value))) {
      return false;
    }
  }
  if (typeof value === "string" && schema.minLength !== undefined) {
    if (value.length < schema.minLength) {
      return false;
    }
  }
  if (typeof value === "string" && schema.maxLength !== undefined) {
    if (value.length > schema.maxLength) {
      return false;
    }
  }
  if (typeof value === "number" && schema.minimum !== undefined) {
    if (value < schema.minimum) {
      return false;
    }
  }
  if (Array.isArray(value) && schema.maxItems !== undefined) {
    if (value.length > schema.maxItems) {
      return false;
    }
  }
  if (Array.isArray(value) && schema.items) {
    const itemSchema = schema.items;
    if (!value.every((item) => matchesJsonSchema(itemSchema, item))) {
      return false;
    }
  }
  if (isRecord(value) && schema.type === "object") {
    const properties = schema.properties ?? {};
    if (schema.required) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          return false;
        }
      }
    }
    for (const [key, nested] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        continue;
      }
      if (!matchesJsonSchema(nested, value[key])) {
        return false;
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          return false;
        }
      }
    }
  }
  return true;
}

export const PROVENANCE_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sourceUrl", "title", "publishedAt", "sourceType"],
  properties: {
    sourceUrl: { type: "string", minLength: 1 },
    title: { type: "string" },
    publishedAt: { type: "string" },
    sourceType: { type: "string", enum: SOURCE_TYPES },
    author: { type: "string" },
    externalId: { type: "string" },
    discoveredAt: { type: "string" },
    watchBotId: { type: "string" },
  },
};

const SOURCE_PAYLOAD_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["provenance"],
  properties: {
    provenance: PROVENANCE_SCHEMA,
  },
};

const NON_NEGATIVE_NUMBER_SCHEMA: JsonSchemaNode = {
  type: "number",
  minimum: 0,
};

const X_METRICS_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    replyCount: NON_NEGATIVE_NUMBER_SCHEMA,
    repostCount: NON_NEGATIVE_NUMBER_SCHEMA,
    quoteCount: NON_NEGATIVE_NUMBER_SCHEMA,
    likeCount: NON_NEGATIVE_NUMBER_SCHEMA,
    viewCount: NON_NEGATIVE_NUMBER_SCHEMA,
    bookmarkCount: NON_NEGATIVE_NUMBER_SCHEMA,
  },
};

const X_MEDIA_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["mediaKey", "type"],
  properties: {
    mediaKey: { type: "string", minLength: 1, maxLength: 100 },
    type: {
      type: "string",
      enum: ["photo", "video", "animated_gif"],
    },
    url: { type: "string", minLength: 1, maxLength: 2_000 },
    previewImageUrl: { type: "string", minLength: 1, maxLength: 2_000 },
    playbackUrl: { type: "string", minLength: 1, maxLength: 2_000 },
    width: NON_NEGATIVE_NUMBER_SCHEMA,
    height: NON_NEGATIVE_NUMBER_SCHEMA,
    durationMs: NON_NEGATIVE_NUMBER_SCHEMA,
    altText: { type: "string", maxLength: 1_000 },
    viewCount: NON_NEGATIVE_NUMBER_SCHEMA,
  },
};

const X_PAYLOAD_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["provenance"],
  properties: {
    provenance: PROVENANCE_SCHEMA,
    postText: { type: "string", maxLength: 5_000 },
    authorDisplayName: { type: "string", maxLength: 200 },
    username: { type: "string", maxLength: 15 },
    authorAvatarUrl: { type: "string", minLength: 1, maxLength: 2_000 },
    metrics: X_METRICS_SCHEMA,
    media: { type: "array", maxItems: 4, items: X_MEDIA_SCHEMA },
  },
};

const NOTE_PAYLOAD_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string" },
  },
};

const AI_SUMMARY_PAYLOAD_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "sourceCardIds"],
  properties: {
    summary: { type: "string" },
    sourceCardIds: { type: "array", items: { type: "string" } },
  },
};

const WATCHBOT_STATUS_PAYLOAD_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["watchBotId"],
  properties: {
    watchBotId: { type: "string", minLength: 1 },
  },
};

const TIMELINE_PAYLOAD_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["itemCardIds"],
  properties: {
    itemCardIds: { type: "array", items: { type: "string" } },
  },
};

const CHART_PAYLOAD_SCHEMA: ObjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind"],
  properties: {
    kind: { type: "string" },
    symbol: { type: "string", minLength: 1, maxLength: 12 },
    name: { type: "string", minLength: 1, maxLength: 160 },
    price: { type: "number", minimum: 0 },
    currency: { type: "string", minLength: 3, maxLength: 3 },
    change: { type: "number" },
    changePercent: { type: "number" },
    previousClose: { type: "number", minimum: 0 },
    marketState: { type: "string", minLength: 1, maxLength: 40 },
    asOf: { type: "string", minLength: 1, maxLength: 64 },
    points: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["t", "value"],
        properties: {
          t: { type: "string", minLength: 1, maxLength: 64 },
          value: { type: "number", minimum: 0 },
        },
      },
    },
  },
};

export const PAYLOAD_SCHEMAS: { [K in CardType]: ObjectJsonSchema } = {
  note: NOTE_PAYLOAD_SCHEMA,
  article: SOURCE_PAYLOAD_SCHEMA,
  web: SOURCE_PAYLOAD_SCHEMA,
  news: SOURCE_PAYLOAD_SCHEMA,
  youtube: SOURCE_PAYLOAD_SCHEMA,
  x: X_PAYLOAD_SCHEMA,
  reddit: SOURCE_PAYLOAD_SCHEMA,
  instagram: SOURCE_PAYLOAD_SCHEMA,
  ai_summary: AI_SUMMARY_PAYLOAD_SCHEMA,
  watchbot_status: WATCHBOT_STATUS_PAYLOAD_SCHEMA,
  timeline: TIMELINE_PAYLOAD_SCHEMA,
  chart: CHART_PAYLOAD_SCHEMA,
};

/** Unique payload schemas for catalog `oneOf` (shared source types collapse). */
export const PAYLOAD_SCHEMA_ONE_OF: ObjectJsonSchema[] = (() => {
  const seen = new Set<ObjectJsonSchema>();
  const schemas: ObjectJsonSchema[] = [];
  for (const type of CARD_TYPES) {
    const schema = PAYLOAD_SCHEMAS[type];
    if (!seen.has(schema)) {
      seen.add(schema);
      schemas.push(schema);
    }
  }
  return schemas;
})();

export function typePayloadCouplingAllOf(): Array<{
  if: { properties: { type: { const: CardType } }; required: ["type"] };
  then: { properties: { payload: ObjectJsonSchema } };
}> {
  return CARD_TYPES.map((cardType) => ({
    if: {
      properties: { type: { const: cardType } },
      required: ["type"],
    },
    then: {
      properties: { payload: PAYLOAD_SCHEMAS[cardType] },
    },
  }));
}

export function isCardProvenance(value: unknown): value is CardProvenance {
  return matchesJsonSchema(PROVENANCE_SCHEMA, value);
}

export function isValidNotePayload(payload: unknown): payload is NotePayload {
  return matchesJsonSchema(PAYLOAD_SCHEMAS.note, payload);
}

export function isValidSourcePayload(
  payload: unknown,
): payload is SourceCardPayload {
  return matchesJsonSchema(PAYLOAD_SCHEMAS.youtube, payload);
}

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isSafeAssetUrl(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function isSemanticallyValidXPayload(payload: XCardPayload): boolean {
  if (payload.authorAvatarUrl && !isSafeAssetUrl(payload.authorAvatarUrl)) {
    return false;
  }
  if (payload.username && !/^[A-Za-z0-9_]{1,15}$/.test(payload.username)) {
    return false;
  }
  if (
    payload.metrics &&
    Object.values(payload.metrics).some((value) => !isNonNegativeInteger(value))
  ) {
    return false;
  }
  return (payload.media ?? []).every((media) => {
    if (
      [media.width, media.height, media.durationMs, media.viewCount]
        .filter((value) => value !== undefined)
        .some((value) => !isNonNegativeInteger(value))
    ) {
      return false;
    }
    if (
      (media.type === "photo" && !media.url) ||
      (media.type !== "photo" && !media.previewImageUrl && !media.playbackUrl)
    ) {
      return false;
    }
    return [media.url, media.previewImageUrl, media.playbackUrl]
      .filter((value) => value !== undefined)
      .every(isSafeAssetUrl);
  });
}

function isSemanticallyValidStockPayload(payload: unknown): payload is StockChartPayload {
  if (!isRecord(payload) || payload.kind !== "stock") {
    return false;
  }
  if (typeof payload.symbol !== "string" || !/^[A-Z][A-Z0-9.\-]{0,11}$/.test(payload.symbol)) {
    return false;
  }
  if (payload.currency !== undefined && !/^[A-Z]{3}$/.test(String(payload.currency))) {
    return false;
  }
  if (payload.asOf !== undefined && Number.isNaN(Date.parse(String(payload.asOf)))) {
    return false;
  }
  return true;
}

export function isValidCardPayload<T extends CardType>(
  type: T,
  payload: unknown,
): payload is CardPayloadByType[T] {
  if (!matchesJsonSchema(PAYLOAD_SCHEMAS[type], payload)) {
    return false;
  }
  if (!(SOURCE_CARD_TYPES as readonly string[]).includes(type)) {
    return type !== "chart" ||
      (payload as { kind?: unknown }).kind !== "stock" ||
      isSemanticallyValidStockPayload(payload);
  }
  const validSourceUrl = isSafeSourceUrl(
    (payload as { provenance: { sourceUrl: unknown } }).provenance.sourceUrl,
  );
  if (!validSourceUrl) {
    return false;
  }
  return type !== "x" || isSemanticallyValidXPayload(payload as XCardPayload);
}
