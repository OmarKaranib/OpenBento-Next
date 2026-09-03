import { describe, expect, it } from "vitest";
import { ACTION_CATALOG } from "./actions";
import {
  PAYLOAD_SCHEMA_ONE_OF,
  PAYLOAD_SCHEMAS,
  isValidCardPayload,
  isValidNotePayload,
  isSafeSourceUrl,
  matchesJsonSchema,
} from "./payloads";
import { CARD_TYPES } from "./types";

const sourceProvenance = {
  sourceUrl: "https://example.com/story",
  title: "Story",
  publishedAt: "2026-08-01T00:00:00.000Z",
  sourceType: "web" as const,
};

describe("PAYLOAD_SCHEMAS", () => {
  it("covers every CardType", () => {
    expect(Object.keys(PAYLOAD_SCHEMAS).sort()).toEqual(
      [...CARD_TYPES].sort(),
    );
  });

  it("is used by createCard.inputSchema instead of a bare object payload", () => {
    const payloadSchema = ACTION_CATALOG.createCard.inputSchema.properties
      .payload as { oneOf: unknown[] };
    expect(payloadSchema).not.toEqual({ type: "object" });
    expect(payloadSchema.oneOf).toEqual(PAYLOAD_SCHEMA_ONE_OF);
    expect(payloadSchema.oneOf).toContain(PAYLOAD_SCHEMAS.note);
    expect(payloadSchema.oneOf).toContain(PAYLOAD_SCHEMAS.youtube);
    expect(payloadSchema.oneOf).toContain(PAYLOAD_SCHEMAS.ai_summary);
    expect(payloadSchema.oneOf).toContain(PAYLOAD_SCHEMAS.watchbot_status);
    expect(payloadSchema.oneOf).toContain(PAYLOAD_SCHEMAS.timeline);
    expect(payloadSchema.oneOf).toContain(PAYLOAD_SCHEMAS.chart);

    const updatePayload = ACTION_CATALOG.updateCard.inputSchema.properties
      .payload as { oneOf: unknown[] };
    expect(updatePayload).not.toEqual({ type: "object" });
    expect(updatePayload.oneOf).toEqual(PAYLOAD_SCHEMA_ONE_OF);
  });

  it("couples type to the matching payload schema on create and update", () => {
    const createAllOf = ACTION_CATALOG.createCard.inputSchema.allOf ?? [];
    const updateAllOf = ACTION_CATALOG.updateCard.inputSchema.allOf ?? [];
    expect(createAllOf).toHaveLength(CARD_TYPES.length);
    expect(updateAllOf).toHaveLength(CARD_TYPES.length);
    expect(createAllOf).toEqual(
      expect.arrayContaining([
        {
          if: {
            properties: { type: { const: "note" } },
            required: ["type"],
          },
          then: { properties: { payload: PAYLOAD_SCHEMAS.note } },
        },
        {
          if: {
            properties: { type: { const: "youtube" } },
            required: ["type"],
          },
          then: { properties: { payload: PAYLOAD_SCHEMAS.youtube } },
        },
      ]),
    );
  });

  it("validates note, source, and typed analysis payloads", () => {
    expect(isValidNotePayload({ text: "hello" })).toBe(true);
    expect(isValidCardPayload("note", { text: "hello" })).toBe(true);
    expect(
      isValidCardPayload("youtube", { provenance: sourceProvenance }),
    ).toBe(true);
    expect(isValidCardPayload("youtube", { text: "hello" })).toBe(false);
    expect(isValidCardPayload("note", { provenance: sourceProvenance })).toBe(
      false,
    );

    expect(
      isValidCardPayload("ai_summary", {
        summary: "Brief",
        sourceCardIds: ["c1"],
      }),
    ).toBe(true);
    expect(isValidCardPayload("ai_summary", { summary: "Brief" })).toBe(false);
    expect(isValidCardPayload("ai_summary", {})).toBe(false);

    expect(
      isValidCardPayload("watchbot_status", { watchBotId: "wb1" }),
    ).toBe(true);
    expect(isValidCardPayload("watchbot_status", { foo: 1 })).toBe(false);
    expect(isValidCardPayload("watchbot_status", {})).toBe(false);

    expect(isValidCardPayload("timeline", { itemCardIds: ["c1"] })).toBe(true);
    expect(isValidCardPayload("timeline", { itemCardIds: [1] })).toBe(false);
    expect(isValidCardPayload("timeline", {})).toBe(false);

    expect(isValidCardPayload("chart", { kind: "line" })).toBe(true);
    expect(isValidCardPayload("chart", {})).toBe(false);
  });

  it("accepts only safe http(s) source URLs in source payloads", () => {
    expect(isSafeSourceUrl("https://example.com/story")).toBe(true);
    expect(isSafeSourceUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeSourceUrl("data:text/html,hello")).toBe(false);
    expect(isSafeSourceUrl("https://user:pass@example.com/story")).toBe(false);
    expect(
      isValidCardPayload("article", {
        provenance: { ...sourceProvenance, sourceUrl: "javascript:alert(1)" },
      }),
    ).toBe(false);
  });

  it("keeps minimal X payloads valid and validates explicit rich fields", () => {
    const xProvenance = { ...sourceProvenance, sourceType: "x" as const };
    expect(isValidCardPayload("x", { provenance: xProvenance })).toBe(true);
    expect(
      isValidCardPayload("x", {
        provenance: xProvenance,
        postText: "A source-backed update",
        authorDisplayName: "OpenBento",
        username: "openbento",
        authorAvatarUrl: "https://pbs.twimg.com/profile_images/1/avatar.jpg",
        metrics: { replyCount: 0, repostCount: 2, likeCount: 7 },
        media: [
          {
            mediaKey: "3_10",
            type: "video",
            previewImageUrl: "https://pbs.twimg.com/media/poster.jpg",
            playbackUrl: "https://video.twimg.com/ext_tw_video/10/video/a.mp4",
            width: 720,
            height: 720,
          },
        ],
      }),
    ).toBe(true);
  });

  it("rejects malformed X presentation data without changing other sources", () => {
    const xProvenance = { ...sourceProvenance, sourceType: "x" as const };
    expect(
      isValidCardPayload("x", {
        provenance: xProvenance,
        username: "not a handle",
      }),
    ).toBe(false);
    expect(
      isValidCardPayload("x", {
        provenance: xProvenance,
        metrics: { likeCount: -1 },
      }),
    ).toBe(false);
    expect(
      isValidCardPayload("x", {
        provenance: xProvenance,
        media: [
          {
            mediaKey: "3_10",
            type: "video",
            playbackUrl: "javascript:alert(1)",
          },
        ],
      }),
    ).toBe(false);
    expect(isValidCardPayload("news", { provenance: sourceProvenance })).toBe(
      true,
    );
    expect(
      isValidCardPayload("news", {
        provenance: sourceProvenance,
        postText: "X-only field",
      }),
    ).toBe(false);
  });

  it("shares schema matching between PAYLOAD_SCHEMAS and isValidCardPayload", () => {
    const payload = { kind: "bar" };
    expect(matchesJsonSchema(PAYLOAD_SCHEMAS.chart, payload)).toBe(true);
    expect(isValidCardPayload("chart", payload)).toBe(true);
    expect(matchesJsonSchema(PAYLOAD_SCHEMAS.note, payload)).toBe(false);
    expect(isValidCardPayload("note", payload)).toBe(false);
  });
});
