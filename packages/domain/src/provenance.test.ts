import { describe, expect, it } from "vitest";
import { ACTION_CATALOG } from "./actions";
import { cardTypeRequiresProvenance, isNoteCardType } from "./provenance";
import { SOURCE_CARD_TYPES } from "./types";

describe("provenance rules", () => {
  it("requires provenance on externally discovered source Cards", () => {
    for (const type of SOURCE_CARD_TYPES) {
      expect(cardTypeRequiresProvenance(type)).toBe(true);
    }
  });

  it("does not require provenance on notes and does not invent a source URL", () => {
    expect(isNoteCardType("note")).toBe(true);
    expect(cardTypeRequiresProvenance("note")).toBe(false);
  });

  it("does not treat moveCard or resizeCard as provenance writes", () => {
    expect(ACTION_CATALOG.moveCard.inputSchema.properties).not.toHaveProperty(
      "provenance",
    );
    expect(ACTION_CATALOG.resizeCard.inputSchema.properties).not.toHaveProperty(
      "provenance",
    );
    expect(ACTION_CATALOG.createCard.inputSchema.required).not.toContain(
      "provenance",
    );
    expect(ACTION_CATALOG.updateCard.inputSchema.required).not.toContain(
      "provenance",
    );
  });
});
