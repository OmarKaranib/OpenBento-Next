import { describe, expect, it } from "vitest";
import { SameCanvasMembershipError } from "@openbento/domain";
import { InMemoryDomainAdapter, LOCAL_SESSION_OWNER_ID } from "./memory-adapter";
import { buildCreateNoteCardInput } from "./note-card";

describe("temporary in-memory domain adapter", () => {
  it("stamps ownerId on records and never requires it on inputs", () => {
    const adapter = new InMemoryDomainAdapter({ seedDefaultCanvas: false });
    const canvas = adapter.execute("createCanvas", { name: "Alpha" });
    expect(canvas.ownerId).toBe(LOCAL_SESSION_OWNER_ID);
    expect(canvas).not.toHaveProperty("inputOwnerId");
  });

  it("replays undoable domain actions on redo without rewriting fullscreen geometry", () => {
    const adapter = new InMemoryDomainAdapter({ seedDefaultCanvas: false });
    const canvas = adapter.execute("createCanvas", { name: "Alpha" });
    const card = adapter.execute(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        text: "Note",
        position: { x: 10, y: 10 },
      }),
    );
    const frame = adapter.execute("createFrame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 200, height: 200 },
    });
    adapter.execute("setCardFrame", { cardId: card.id, frameId: frame.id });

    const before = adapter.getCanvasStateFor(canvas.id);
    const view = adapter.execute("fullscreenFrame", {
      frameId: frame.id,
      active: true,
    });
    expect(view.active).toBe(true);
    const after = adapter.getCanvasStateFor(canvas.id);
    expect(after.frames[0]?.bounds).toEqual(before.frames[0]?.bounds);
    expect(after.cards[0]?.position).toEqual(before.cards[0]?.position);
    expect(after.cards[0]?.size).toEqual(before.cards[0]?.size);

    adapter.undo();
    expect(
      adapter.getSnapshot().cards.find((entry) => entry.id === card.id)
        ?.frameId ?? null,
    ).toBeNull();
    adapter.redo();
    expect(
      adapter.getSnapshot().cards.find((entry) => entry.id === card.id)
        ?.frameId,
    ).toBe(frame.id);
  });

  it("rejects setCardFrame across canvases", () => {
    const adapter = new InMemoryDomainAdapter({ seedDefaultCanvas: false });
    const a = adapter.execute("createCanvas", { name: "A" });
    const b = adapter.execute("createCanvas", { name: "B" });
    const card = adapter.execute(
      "createCard",
      buildCreateNoteCardInput({ canvasId: a.id, text: "x" }),
    );
    const frame = adapter.execute("createFrame", {
      canvasId: b.id,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    });
    expect(() =>
      adapter.execute("setCardFrame", { cardId: card.id, frameId: frame.id }),
    ).toThrow(SameCanvasMembershipError);
  });

  it("persists camera via updateCanvasViewport without undo history", () => {
    const adapter = new InMemoryDomainAdapter({ seedDefaultCanvas: false });
    const canvas = adapter.execute(
      "createCanvas",
      { name: "Cam" },
      { history: false },
    );
    adapter.execute(
      "updateCanvasViewport",
      {
        canvasId: canvas.id,
        viewport: { x: 40, y: -20, zoom: 1.25 },
      },
      { history: false },
    );
    expect(adapter.getSnapshot().canUndo).toBe(false);
    expect(
      adapter.getCanvasStateFor(canvas.id).canvas.viewport,
    ).toEqual({ x: 40, y: -20, zoom: 1.25 });
  });
});
