import { describe, expect, it } from "vitest";
import {
  canvasFromRecord,
  canvasToRecord,
  cardFromRecord,
  cardToRecord,
  frameFromRecord,
  frameToRecord,
  watchBotFromRecord,
  watchBotToRecord,
} from "./mappers";
import type { CardRecord } from "./schema";

describe("record mappers", () => {
  it("round-trips canvas, frame, and watchbot records", () => {
    const canvas = canvasFromRecord({
      id: "c1",
      owner_id: "user-a",
      name: "Board",
      viewport_x: 1,
      viewport_y: 2,
      viewport_zoom: 1.5,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
      last_opened_at: null,
    });
    expect(canvas.ownerId).toBe("user-a");
    expect(canvas.viewport).toEqual({ x: 1, y: 2, zoom: 1.5 });
    expect(canvasToRecord(canvas).owner_id).toBe("user-a");

    const frame = frameFromRecord({
      id: "f1",
      canvas_id: "c1",
      name: "Main",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      z_index: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    });
    expect(frameToRecord(frame).canvas_id).toBe("c1");

    const bot = watchBotFromRecord({
      id: "w1",
      owner_id: "user-a",
      canvas_id: "c1",
      name: null,
      instruction: "Watch",
      status: "running",
      source_types: ["web"],
      last_error: null,
      last_activity_at: null,
      next_run_at: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    });
    expect(watchBotToRecord(bot).owner_id).toBe("user-a");
    expect(watchBotToRecord(bot).status).toBe("running");
  });

  it("rejects a card record whose payload does not match type", () => {
    const row: CardRecord = {
      id: "card-1",
      canvas_id: "c1",
      frame_id: null,
      type: "note",
      payload: { provenance: { sourceUrl: "https://x.test" } },
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      z_index: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    };
    expect(() => cardFromRecord(row)).toThrow(/PAYLOAD_SCHEMAS/);
    expect(
      cardToRecord({
        id: "card-2",
        canvasId: "c1",
        type: "note",
        payload: { text: "ok" },
        position: { x: 0, y: 0 },
        size: { width: 10, height: 10 },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }).payload,
    ).toEqual({ text: "ok" });
  });
});
