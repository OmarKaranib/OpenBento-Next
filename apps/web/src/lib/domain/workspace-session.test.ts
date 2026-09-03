import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { InMemoryDomainStore } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";
import { IdSequence } from "../../server/ids";
import { runDomainActionFromRequest } from "../../server/run-action";
import { requestAuthFromVerifiedUser } from "../../server/session";
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
        requestAuthFromVerifiedUser(ownerId),
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

  it("restores canvas state from the store on login/reload", async () => {
    const store = new InMemoryDomainStore();
    const ids = new IdSequence();
    const first = new WorkspaceSession({
      seedDefaultCanvas: false,
      runAction: (name, input) =>
        runDomainActionFromRequest(
          requestAuthFromVerifiedUser("session-user"),
          name,
          input,
          { store, id: ids.next },
        ),
      resetStore: () => undefined,
    });
    const canvas = await first.execute("createCanvas", { name: "Kept" });
    await first.execute(
      "updateCanvasViewport",
      {
        canvasId: canvas.id,
        viewport: { x: 3, y: 4, zoom: 2 },
      },
      { history: false },
    );
    await first.execute(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        text: "survives reload",
      }),
    );

    const restored = new WorkspaceSession({
      seedDefaultCanvas: true,
      restoreCanvases: () => store.listCanvasesByOwner("session-user"),
      runAction: (name, input) =>
        runDomainActionFromRequest(
          requestAuthFromVerifiedUser("session-user"),
          name,
          input,
          { store, id: ids.next },
        ),
      resetStore: () => undefined,
    });
    await restored.start();
    const snap = restored.getSnapshot();
    expect(snap.canvases[0]?.name).toBe("Kept");
    expect(snap.canvases[0]?.viewport).toEqual({ x: 3, y: 4, zoom: 2 });
    expect(snap.cards[0]?.payload).toEqual({ text: "survives reload" });
    expect(snap.currentCanvasId).toBe(canvas.id);
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

function createSharedSession(ownerId = "session-user") {
  const store = new InMemoryDomainStore();
  const ids = new IdSequence();
  const calls: string[] = [];
  let blockedGet:
    | {
        canvasId?: string;
        started: () => void;
        wait: Promise<void>;
      }
    | undefined;
  const session = new WorkspaceSession({
    seedDefaultCanvas: false,
    runAction: async (name, input) => {
      calls.push(name);
      const result = await runDomainActionFromRequest(
        requestAuthFromVerifiedUser(ownerId),
        name,
        input,
        { store, id: ids.next },
      );
      if (
        name === "getCanvasState" &&
        blockedGet &&
        (!blockedGet.canvasId || blockedGet.canvasId === input.canvasId)
      ) {
        const gate = blockedGet;
        blockedGet = undefined;
        gate.started();
        await gate.wait;
      }
      return result;
    },
    resetStore: () => undefined,
  });
  const workerRun = <N extends import("@openbento/domain").ActionName>(
    name: N,
    input: import("@openbento/domain").ActionInputMap[N],
  ) =>
    runDomainActionFromRequest(
      requestAuthFromVerifiedUser(ownerId),
      name,
      input,
      { store, id: ids.next },
    );
  const blockNextGet = (canvasId?: string) => {
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    blockedGet = { canvasId, started: markStarted, wait };
    return { started, release };
  };
  return { session, workerRun, store, calls, blockNextGet };
}

describe("WorkspaceSession.syncExternalState", () => {
  it("publishes an externally written Card without undo or geometry writes", async () => {
    const { session, workerRun, calls } = createSharedSession();
    const canvas = await session.execute(
      "createCanvas",
      { name: "Live" },
      { history: false },
    );
    const local = await session.execute(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        text: "mine",
        position: { x: 8, y: 12 },
      }),
    );
    const before = session.getSnapshot();
    expect(before.canUndo).toBe(true);
    expect(before.canRedo).toBe(false);

    await session.execute(
      "updateCanvasViewport",
      {
        canvasId: canvas.id,
        viewport: { x: 40, y: -16, zoom: 1.5 },
      },
      { history: false },
    );
    const viewportBefore = session.getSnapshot().canvases[0]?.viewport;

    calls.length = 0;
    const external = await workerRun(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        text: "worker card",
        position: { x: 200, y: 80 },
      }),
    );

    expect(session.getSnapshot().cards.map((card) => card.id)).not.toContain(
      external.id,
    );

    const applied = await session.syncExternalState();
    expect(applied).toBe(true);
    const after = session.getSnapshot();
    expect(after.cards.map((card) => card.id)).toContain(external.id);
    expect(after.cards.find((card) => card.id === local.id)?.position).toEqual({
      x: 8,
      y: 12,
    });
    expect(after.cards.find((card) => card.id === local.id)?.size).toEqual(
      local.size,
    );
    expect(after.canUndo).toBe(before.canUndo);
    expect(after.canRedo).toBe(before.canRedo);
    expect(after.canvases[0]?.viewport).toEqual(viewportBefore);
    expect(calls.every((name) => name === "getCanvasState")).toBe(true);
    expect(calls.some((name) => name === "moveCard")).toBe(false);
    expect(calls.some((name) => name === "resizeCard")).toBe(false);
    expect(calls.some((name) => name === "setCardFrame")).toBe(false);
    expect(calls.some((name) => name === "updateCard")).toBe(false);
    expect(calls.some((name) => name === "updateCanvasViewport")).toBe(false);

    expect(await session.undo()).toBe(true);
    expect(session.getSnapshot().canUndo).toBe(false);
    expect(session.getSnapshot().canRedo).toBe(true);
  });

  it("publishes external WatchBot count and status", async () => {
    const { session, workerRun } = createSharedSession();
    const canvas = await session.execute("createCanvas", { name: "Bots" });
    expect(session.getSnapshot().watchBots).toEqual([]);

    const running = await workerRun("createWatchBot", {
      canvasId: canvas.id,
      instruction: "Watch the story",
      name: "External",
    });
    await session.syncExternalState();
    expect(session.getSnapshot().watchBots).toHaveLength(1);
    expect(session.getSnapshot().watchBots[0]?.status).toBe("running");

    await workerRun("pauseWatchBot", { watchBotId: running.id });
    const second = await workerRun("createWatchBot", {
      canvasId: canvas.id,
      instruction: "Second bot",
      name: "Another",
    });
    await session.syncExternalState();
    const bots = session.getSnapshot().watchBots;
    expect(bots).toHaveLength(2);
    expect(bots.find((bot) => bot.id === running.id)?.status).toBe("paused");
    expect(bots.find((bot) => bot.id === second.id)?.status).toBe("running");
  });

  it("skips the merge while interacting and applies after endInteraction", async () => {
    const { session, workerRun } = createSharedSession();
    const canvas = await session.execute("createCanvas", { name: "Busy" });
    session.beginInteraction();
    const external = await workerRun(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        text: "deferred",
      }),
    );
    expect(await session.syncExternalState()).toBe(false);
    expect(session.getSnapshot().cards.map((card) => card.id)).not.toContain(
      external.id,
    );
    await session.endInteraction();
    expect(session.getSnapshot().cards.map((card) => card.id)).toContain(
      external.id,
    );
  });

  it("discards an in-flight read when a local interaction starts", async () => {
    const { session, workerRun, blockNextGet } = createSharedSession();
    const canvas = await session.execute("createCanvas", { name: "Drag" });
    const gate = blockNextGet(canvas.id);
    const sync = session.syncExternalState();
    await gate.started;
    session.beginInteraction();
    const external = await workerRun(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        text: "arrived during drag",
      }),
    );
    gate.release();

    expect(await sync).toBe(false);
    expect(session.getSnapshot().cards.map((card) => card.id)).not.toContain(
      external.id,
    );
    await session.endInteraction();
    expect(session.getSnapshot().cards.map((card) => card.id)).toContain(
      external.id,
    );
  });

  it("does not apply the old Canvas response after a Canvas switch", async () => {
    const { session, blockNextGet } = createSharedSession();
    const first = await session.execute("createCanvas", { name: "First" });
    const firstCard = await session.execute(
      "createCard",
      buildCreateNoteCardInput({ canvasId: first.id, text: "first" }),
    );
    const second = await session.execute("createCanvas", { name: "Second" });
    const secondCard = await session.execute(
      "createCard",
      buildCreateNoteCardInput({ canvasId: second.id, text: "second" }),
    );
    await session.execute("switchCanvas", { canvasId: first.id });

    const gate = blockNextGet(first.id);
    const staleSync = session.syncExternalState();
    await gate.started;
    await session.execute("switchCanvas", { canvasId: second.id });
    gate.release();
    expect(await staleSync).toBe(false);

    const snapshot = session.getSnapshot();
    expect(snapshot.currentCanvasId).toBe(second.id);
    expect(snapshot.cards.map((card) => card.id)).toContain(secondCard.id);
    expect(snapshot.cards.map((card) => card.id)).not.toContain(firstCard.id);
  });

  it("does not clobber a local mutation that completes during a poll", async () => {
    const { session, blockNextGet } = createSharedSession();
    const canvas = await session.execute("createCanvas", { name: "Local" });
    const gate = blockNextGet(canvas.id);
    const staleSync = session.syncExternalState();
    await gate.started;
    const local = await session.execute(
      "createCard",
      buildCreateNoteCardInput({ canvasId: canvas.id, text: "keep me" }),
    );
    gate.release();

    expect(await staleSync).toBe(false);
    expect(session.getSnapshot().cards.map((card) => card.id)).toContain(local.id);
  });

  it("preserves the current snapshot when a poll fails", async () => {
    const store = new InMemoryDomainStore();
    const ids = new IdSequence();
    let failNextRead = false;
    const session = new WorkspaceSession({
      seedDefaultCanvas: false,
      runAction: (name, input) => {
        if (name === "getCanvasState" && failNextRead) {
          failNextRead = false;
          throw new Error("temporary read failure");
        }
        return runDomainActionFromRequest(
          requestAuthFromVerifiedUser("session-user"),
          name,
          input,
          { store, id: ids.next },
        );
      },
      resetStore: () => undefined,
    });
    const canvas = await session.execute("createCanvas", { name: "Stable" });
    await session.execute(
      "createCard",
      buildCreateNoteCardInput({ canvasId: canvas.id, text: "stay" }),
    );
    const before = session.getSnapshot();
    failNextRead = true;

    await expect(session.syncExternalState()).rejects.toThrow(
      "temporary read failure",
    );
    expect(session.getSnapshot()).toBe(before);
  });

  it("does not start a second getCanvasState while one is in flight", async () => {
    const store = new InMemoryDomainStore();
    const ids = new IdSequence();
    let release!: () => void;
    let getCanvasStateCount = 0;
    let blockGets = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const session = new WorkspaceSession({
      seedDefaultCanvas: false,
      runAction: async (name, input) => {
        const result = await runDomainActionFromRequest(
          requestAuthFromVerifiedUser("session-user"),
          name,
          input,
          { store, id: ids.next },
        );
        if (name === "getCanvasState" && blockGets) {
          getCanvasStateCount += 1;
          await gate;
        }
        return result;
      },
      resetStore: () => undefined,
    });
    await session.execute("createCanvas", { name: "Gate" });
    blockGets = true;
    getCanvasStateCount = 0;
    const first = session.syncExternalState();
    const second = session.syncExternalState();
    await vi.waitFor(() => {
      expect(getCanvasStateCount).toBe(1);
    });
    release();
    await first;
    await second;
  });

  it("stops syncing after dispose", async () => {
    const { session, workerRun } = createSharedSession();
    const canvas = await session.execute("createCanvas", { name: "Gone" });
    session.dispose();
    await workerRun(
      "createCard",
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        text: "late",
      }),
    );
    expect(await session.syncExternalState()).toBe(false);
  });
});
