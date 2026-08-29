import { describe, expect, it } from "vitest";
import { ACTION_CATALOG } from "./actions";
import {
  cardTypeRequiresProvenance,
  isNoteCardType,
  isValidCardPayload,
  isValidNotePayload,
} from "./provenance";
import { SOURCE_CARD_TYPES } from "./types";

const sourceProvenance = {
  sourceUrl: "https://example.com/story",
  title: "Story",
  publishedAt: "2026-08-01T00:00:00.000Z",
  sourceType: "web" as const,
};

describe("provenance rules", () => {
  it("requires provenance on externally discovered source Cards", () => {
    for (const type of SOURCE_CARD_TYPES) {
      expect(cardTypeRequiresProvenance(type)).toBe(true);
      expect(isValidCardPayload(type, { provenance: sourceProvenance })).toBe(
        true,
      );
      expect(isValidCardPayload(type, { text: "nope" })).toBe(false);
    }
  });

  it("does not allow fake provenance on notes", () => {
    expect(isNoteCardType("note")).toBe(true);
    expect(cardTypeRequiresProvenance("note")).toBe(false);
    expect(isValidNotePayload({ text: "hello" })).toBe(true);
    expect(
      isValidCardPayload("note", { text: "hello", provenance: sourceProvenance }),
    ).toBe(false);
    expect(isValidCardPayload("note", { provenance: sourceProvenance })).toBe(
      false,
    );
  });

  it("models createCard/updateCard as type plus payload, not title/body", () => {
    expect(ACTION_CATALOG.createCard.inputSchema.required).toEqual([
      "canvasId",
      "type",
      "payload",
    ]);
    expect(ACTION_CATALOG.updateCard.inputSchema.required).toEqual([
      "cardId",
      "payload",
    ]);
    expect(ACTION_CATALOG.createCard.inputSchema.properties).not.toHaveProperty(
      "title",
    );
    expect(ACTION_CATALOG.createCard.inputSchema.properties).not.toHaveProperty(
      "body",
    );
    expect(ACTION_CATALOG.updateCard.inputSchema.properties).not.toHaveProperty(
      "title",
    );
    expect(ACTION_CATALOG.updateCard.inputSchema.properties).not.toHaveProperty(
      "body",
    );
  });

  it("does not treat moveCard or resizeCard as provenance writes", () => {
    expect(ACTION_CATALOG.moveCard.inputSchema.properties).not.toHaveProperty(
      "provenance",
    );
    expect(ACTION_CATALOG.resizeCard.inputSchema.properties).not.toHaveProperty(
      "provenance",
    );
    expect(ACTION_CATALOG.moveCard.inputSchema.properties).not.toHaveProperty(
      "payload",
    );
  });
});
