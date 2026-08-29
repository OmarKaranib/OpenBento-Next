import { describe, expect, it } from "vitest";
import { InMemoryDomainStore } from "@openbento/domain";
import { WorkspaceSession } from "./workspace-session";
import { buildCreateNoteCardInput } from "./note-card";

describe("workspace session uses the shared executor", () => {
  it("replays undoable catalog actions without rewriting fullscreen geometry", async () => {
    const session = new WorkspaceSession({
      seedDefaultCanvas: false,
      store: new InMemoryDomainStore(),
    });
    const canvas = await session.execute("createCanvas", { name: "Alpha" });
    const card = await session.execute(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        text: "Note",
        position: { x: 10, y: 10 },
      }),
    );
    const frame = await session.execute("createFrame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 200, height: 200 },
    });
    await session.execute("setCardFrame", { cardId: card.id, frameId: frame.id });

    const before = session.getSnapshot();
    const view = await session.execute(
      "fullscreenFrame",
      { frameId: frame.id, active: true },
      { history: false },
    );
    expect(view.active).toBe(true);
    const after = session.getSnapshot();
    expect(after.frames[0]?.bounds).toEqual(before.frames[0]?.bounds);
    expect(after.cards[0]?.position).toEqual(before.cards[0]?.position);
    expect(after.cards[0]?.size).toEqual(before.cards[0]?.size);

    await session.undo();
    expect(
      session.getSnapshot().cards.find((entry) => entry.id === card.id)
        ?.frameId ?? null,
    ).toBeNull();
    await session.redo();
    expect(
      session.getSnapshot().cards.find((entry) => entry.id === card.id)?.frameId,
    ).toBe(frame.id);
  });

  it("persists camera via updateCanvasViewport without undo history", async () => {
    const session = new WorkspaceSession({
      seedDefaultCanvas: false,
      store: new InMemoryDomainStore(),
    });
    const canvas = await session.execute(
      "createCanvas",
      { name: "Cam" },
      { history: false },
    );
    await session.execute(
      "updateCanvasViewport",
      {
        canvasId: canvas.id,
        viewport: { x: 40, y: -20, zoom: 1.25 },
      },
      { history: false },
    );
    expect(session.getSnapshot().canUndo).toBe(false);
    expect(session.getSnapshot().canvases[0]?.viewport).toEqual({
      x: 40,
      y: -20,
      zoom: 1.25,
    });
  });
});
