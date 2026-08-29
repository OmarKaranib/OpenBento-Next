import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { InMemoryDomainStore } from "@openbento/domain";
import { describe, expect, it } from "vitest";
import { IdSequence } from "../../server/ids";
import { runDomainActionFromRequest } from "../../server/run-action";
import { requestAuthFromOwnerCookie } from "../../server/session";
import { buildCreateNoteCardInput } from "./note-card";
import { WorkspaceSession } from "./workspace-session";

const sessionSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "workspace-session.ts"),
  "utf8",
);

function createUiSession(ownerId = "session-user"): WorkspaceSession {
  const box = {
    store: new InMemoryDomainStore(),
    ids: new IdSequence(),
  };
  return new WorkspaceSession({
    seedDefaultCanvas: false,
    runAction: (name, input) =>
      runDomainActionFromRequest(
        requestAuthFromOwnerCookie(ownerId),
        name,
        input,
        { store: box.store, id: box.ids.next },
      ),
    resetStore: () => {
      box.store = new InMemoryDomainStore();
      box.ids.rewind();
    },
  });
}

describe("workspace session uses the shared server executor path", () => {
  it("does not construct a client-side executor or bake in a local owner id", () => {
    expect(sessionSource).not.toMatch(/createActionExecutor/);
    expect(sessionSource).not.toMatch(/LOCAL_SESSION_OWNER_ID/);
    expect(sessionSource).not.toMatch(/InMemoryDomainStore/);
    expect(sessionSource).not.toMatch(/ownerId:/);
  });

  it("cannot pass ownerId from the UI facade; session owner wins", async () => {
    const session = createUiSession("session-user");
    await expect(
      session.execute("createCanvas", {
        name: "Poison",
        ownerId: "attacker",
      } as never),
    ).rejects.toMatchObject({ code: "invalid_input" });

    const canvas = await session.execute("createCanvas", { name: "Owned" });
    expect(canvas.ownerId).toBe("session-user");
    expect(canvas.ownerId).not.toBe("attacker");
  });

  it("fails when the UI path is unauthenticated", async () => {
    const store = new InMemoryDomainStore();
    const session = new WorkspaceSession({
      seedDefaultCanvas: false,
      runAction: (name, input) =>
        runDomainActionFromRequest(
          { cookies: { get: () => undefined } },
          name,
          input,
          { store },
        ),
      resetStore: () => undefined,
    });
    await expect(
      session.execute("createCanvas", { name: "Nope" }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("replays undoable catalog actions without rewriting fullscreen geometry", async () => {
    const session = createUiSession();
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
    const session = createUiSession();
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

  it("keeps membership as a follow-up setCardFrame call", async () => {
    const session = createUiSession();
    const canvas = await session.execute("createCanvas", { name: "Frames" });
    const card = await session.execute(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        text: "Note",
        position: { x: 10, y: 10 },
      }),
    );
    expect(card.frameId ?? null).toBeNull();
    const frame = await session.execute("createFrame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 200, height: 200 },
    });
    const updated = await session.execute("setCardFrame", {
      cardId: card.id,
      frameId: frame.id,
    });
    expect(updated.frameId).toBe(frame.id);
  });
});
