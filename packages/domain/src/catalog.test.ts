import { describe, expect, it } from "vitest";
import {
  ACTION_CATALOG,
  ACTION_CATALOG_LIST,
  ACTION_NAMES,
  actionInputForbidsOwnerId,
} from "./actions";

const FULL_CATALOG = [
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

describe("master action catalog", () => {
  it("exports the full locked catalog, not a 5-action stub", () => {
    expect([...ACTION_NAMES]).toEqual([...FULL_CATALOG]);
    expect(ACTION_NAMES).toHaveLength(20);
    expect(ACTION_CATALOG_LIST).toHaveLength(20);
  });

  it("has a catalog entry for every action name", () => {
    for (const name of ACTION_NAMES) {
      expect(ACTION_CATALOG[name].name).toBe(name);
      expect(ACTION_CATALOG[name].inputSchema.type).toBe("object");
    }
  });

  it("never accepts ownerId on action inputs", () => {
    for (const action of ACTION_CATALOG_LIST) {
      expect(actionInputForbidsOwnerId(action.inputSchema)).toBe(true);
      expect(JSON.stringify(action.inputSchema)).not.toMatch(/ownerId/);
    }
  });

  it("treats moveCard, resizeCard, and updateCanvasViewport as first-class", () => {
    expect(ACTION_CATALOG.moveCard.inputSchema.required).toEqual([
      "cardId",
      "position",
    ]);
    expect(ACTION_CATALOG.resizeCard.inputSchema.required).toEqual([
      "cardId",
      "size",
    ]);
    expect(ACTION_CATALOG.updateCanvasViewport.inputSchema.required).toEqual([
      "canvasId",
      "viewport",
    ]);
    expect(ACTION_CATALOG.updateCard.inputSchema.properties).not.toHaveProperty(
      "position",
    );
    expect(ACTION_CATALOG.updateCard.inputSchema.properties).not.toHaveProperty(
      "size",
    );
  });

  it("requires instruction on createWatchBot", () => {
    expect(ACTION_CATALOG.createWatchBot.inputSchema.required).toEqual([
      "canvasId",
      "instruction",
    ]);
  });

  it("creates and updates Cards via type plus payload", () => {
    expect(ACTION_CATALOG.createCard.inputSchema.required).toContain("payload");
    expect(ACTION_CATALOG.updateCard.inputSchema.required).toContain("payload");
    expect(ACTION_CATALOG.createCard.inputSchema.properties).toHaveProperty(
      "payload",
    );
  });

  it("describes fullscreenFrame as view-only", () => {
    expect(ACTION_CATALOG.fullscreenFrame.description).toMatch(/view-only/i);
    expect(ACTION_CATALOG.fullscreenFrame.description).toMatch(
      /must not rewrite stored/i,
    );
  });
});
