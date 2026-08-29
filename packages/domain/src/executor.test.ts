import { describe, expect, it } from "vitest";
import {
  ACTION_CATALOG,
  ACTION_NAMES,
  actionInputForbidsOwnerId,
  type CreateCardInput,
  type UpdateCardInput,
} from "./actions";
import { DomainError } from "./errors";
import { createActionExecutor } from "./executor";
import { SameCanvasMembershipError } from "./frames";
import { InMemoryDomainStore } from "./store";
import type { CardProvenance } from "./types";

const provenance: CardProvenance = {
  sourceUrl: "https://youtube.com/watch?v=1",
  title: "Video",
  publishedAt: "2026-08-01T00:00:00.000Z",
  sourceType: "youtube",
};

function pair(store = new InMemoryDomainStore()) {
  return {
    store,
    a: createActionExecutor({ store, ownerId: "user-a" }),
    b: createActionExecutor({ store, ownerId: "user-b" }),
  };
}

async function seedOwned(ownerId: "user-a" | "user-b" = "user-a") {
  const { store, a, b } = pair();
  const exec = ownerId === "user-a" ? a : b;
  const canvas = await exec.createCanvas({ name: "Alpha" });
  const card = await exec.createCard({
    canvasId: canvas.id,
    type: "note",
    payload: { text: "hello" },
  });
  const frame = await exec.createFrame({
    canvasId: canvas.id,
    bounds: { x: 0, y: 0, width: 200, height: 200 },
    name: "Main",
  });
  const watchBot = await exec.createWatchBot({
    canvasId: canvas.id,
    instruction: "Watch the story",
  });
  return { store, a, b, canvas, card, frame, watchBot };
}

describe("ActionExecutor catalog coverage", () => {
  it("implements every ACTION_CATALOG name and no others", () => {
    const { a } = pair();
    for (const name of ACTION_NAMES) {
      expect(typeof a[name]).toBe("function");
    }
    expect(ACTION_NAMES).toHaveLength(20);
    expect(Object.keys(ACTION_CATALOG)).toEqual([...ACTION_NAMES]);
  });
});

describe("ownerId is session-derived", () => {
  it("never reads ownerId from action input", async () => {
    const { a } = pair();
    const poisoned = {
      name: "Stolen",
      ownerId: "user-b",
    };
    await expect(a.createCanvas(poisoned as never)).rejects.toMatchObject({
      code: "invalid_input",
    });

    const canvas = await a.createCanvas({ name: "Mine" });
    expect(canvas.ownerId).toBe("user-a");
    expect(canvas.ownerId).not.toBe("user-b");

    const watchBot = await a.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor",
    });
    expect(watchBot.ownerId).toBe("user-a");
  });

  it("keeps ownerId off every catalog input schema", () => {
    for (const action of Object.values(ACTION_CATALOG)) {
      expect(actionInputForbidsOwnerId(action.inputSchema)).toBe(true);
    }
  });
});

describe("IDOR — user A cannot operate user B resources", () => {
  it("rejects canvas, card, frame, and watchbot operations across owners", async () => {
    const { a, b, canvas, card, frame, watchBot } = await seedOwned("user-a");

    const forbidden = [
      () => b.renameCanvas({ canvasId: canvas.id, name: "Hijack" }),
      () => b.switchCanvas({ canvasId: canvas.id }),
      () =>
        b.updateCanvasViewport({
          canvasId: canvas.id,
          viewport: { x: 9, y: 9, zoom: 2 },
        }),
      () =>
        b.createCard({
          canvasId: canvas.id,
          type: "note",
          payload: { text: "nope" },
        }),
      () =>
        b.updateCard({
          cardId: card.id,
          type: "note",
          payload: { text: "nope" },
        }),
      () => b.moveCard({ cardId: card.id, position: { x: 99, y: 99 } }),
      () => b.resizeCard({ cardId: card.id, size: { width: 10, height: 10 } }),
      () => b.setCardFrame({ cardId: card.id, frameId: frame.id }),
      () =>
        b.createFrame({
          canvasId: canvas.id,
          bounds: { x: 0, y: 0, width: 10, height: 10 },
        }),
      () => b.updateFrame({ frameId: frame.id, name: "Hijack" }),
      () => b.moveFrame({ frameId: frame.id, position: { x: 1, y: 1 } }),
      () =>
        b.resizeFrame({ frameId: frame.id, size: { width: 10, height: 10 } }),
      () =>
        b.createWatchBot({
          canvasId: canvas.id,
          instruction: "Hijack",
        }),
      () =>
        b.updateWatchBot({
          watchBotId: watchBot.id,
          instruction: "Hijack",
        }),
      () => b.pauseWatchBot({ watchBotId: watchBot.id }),
      () => b.resumeWatchBot({ watchBotId: watchBot.id }),
      () => b.getCanvasState({ canvasId: canvas.id }),
      () => b.getWatchBotStatus({ watchBotId: watchBot.id }),
      () => b.fullscreenFrame({ frameId: frame.id, active: true }),
    ];

    for (const op of forbidden) {
      await expect(op()).rejects.toBeInstanceOf(DomainError);
      await expect(op()).rejects.toMatchObject({ code: "not_found" });
    }

    const state = await a.getCanvasState({ canvasId: canvas.id });
    expect(state.canvas.name).toBe("Alpha");
    expect(state.canvas.ownerId).toBe("user-a");
    expect(state.cards).toHaveLength(1);
    expect(state.cards[0]?.payload).toEqual({ text: "hello" });
    expect(state.frames[0]?.name).toBe("Main");
    expect(state.watchBots[0]?.instruction).toBe("Watch the story");
    expect(state.watchBots[0]?.status).toBe("running");
  });

  it("lets each owner operate only their own canvas", async () => {
    const { a, b } = pair();
    const canvasA = await a.createCanvas({ name: "A" });
    const canvasB = await b.createCanvas({ name: "B" });

    await expect(a.getCanvasState({ canvasId: canvasB.id })).rejects.toMatchObject({
      code: "not_found",
    });
    const stateB = await b.getCanvasState({ canvasId: canvasB.id });
    expect(stateB.canvas.ownerId).toBe("user-b");
    expect(stateB.canvas.id).toBe(canvasB.id);
    expect(canvasA.ownerId).toBe("user-a");
  });
});

describe("setCardFrame same-canvas membership", () => {
  it("rejects attaching a card to a frame on another canvas", async () => {
    const { a } = pair();
    const canvasA = await a.createCanvas({ name: "One" });
    const canvasB = await a.createCanvas({ name: "Two" });
    const card = await a.createCard({
      canvasId: canvasA.id,
      type: "note",
      payload: { text: "note" },
    });
    const frame = await a.createFrame({
      canvasId: canvasB.id,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    });

    await expect(
      a.setCardFrame({ cardId: card.id, frameId: frame.id }),
    ).rejects.toBeInstanceOf(SameCanvasMembershipError);

    const unchanged = (await a.getCanvasState({ canvasId: canvasA.id }))
      .cards[0];
    expect(unchanged?.frameId ?? null).toBeNull();
  });

  it("allows same-canvas membership and clearing it", async () => {
    const { a, card, frame } = await seedOwned();
    const attached = await a.setCardFrame({
      cardId: card.id,
      frameId: frame.id,
    });
    expect(attached.frameId).toBe(frame.id);
    const cleared = await a.setCardFrame({ cardId: card.id, frameId: null });
    expect(cleared.frameId).toBeNull();
  });
});

describe("illegal type/payload pairs", () => {
  it("rejects note with a source payload and youtube with { text }", async () => {
    const { a, canvas, card } = await seedOwned();

    const noteWithSource = {
      canvasId: canvas.id,
      type: "note",
      payload: { provenance },
    } as unknown as CreateCardInput;
    await expect(a.createCard(noteWithSource)).rejects.toMatchObject({
      code: "invalid_input",
    });

    const youtubeWithText = {
      canvasId: canvas.id,
      type: "youtube",
      payload: { text: "nope" },
    } as unknown as CreateCardInput;
    await expect(a.createCard(youtubeWithText)).rejects.toMatchObject({
      code: "invalid_input",
    });

    await expect(
      a.updateCard({
        cardId: card.id,
        type: "youtube",
        payload: { text: "nope" },
      } as unknown as UpdateCardInput),
    ).rejects.toMatchObject({ code: "invalid_input" });

    const created = await a.createCard({
      canvasId: canvas.id,
      type: "youtube",
      payload: { provenance },
    });
    expect(created.type).toBe("youtube");
    expect(created.payload).toEqual({ provenance });

    const note = await a.createCard({
      canvasId: canvas.id,
      type: "note",
      payload: { text: "ok" },
    });
    expect(note.payload).toEqual({ text: "ok" });
  });
});

describe("fullscreenFrame is view-only", () => {
  it("does not rewrite stored frame or card geometry", async () => {
    const { store, a, canvas, card, frame } = await seedOwned();
    await a.moveCard({ cardId: card.id, position: { x: 40, y: 50 } });
    await a.resizeCard({ cardId: card.id, size: { width: 80, height: 90 } });

    const beforeCard = await store.getCard(card.id);
    const beforeFrame = await store.getFrame(frame.id);
    const view = await a.fullscreenFrame({ frameId: frame.id, active: true });

    expect(view).toEqual({
      frameId: frame.id,
      canvasId: canvas.id,
      active: true,
    });
    expect(await store.getCard(card.id)).toEqual(beforeCard);
    expect(await store.getFrame(frame.id)).toEqual(beforeFrame);

    await a.fullscreenFrame({ frameId: frame.id, active: false });
    expect(await store.getCard(card.id)).toEqual(beforeCard);
    expect(await store.getFrame(frame.id)).toEqual(beforeFrame);
  });
});

describe("WatchBot lifecycle and first-class geometry", () => {
  it("pauses and resumes without a provider", async () => {
    const { a, watchBot } = await seedOwned();
    const paused = await a.pauseWatchBot({ watchBotId: watchBot.id });
    expect(paused.status).toBe("paused");
    const resumed = await a.resumeWatchBot({ watchBotId: watchBot.id });
    expect(resumed.status).toBe("running");
    const status = await a.getWatchBotStatus({ watchBotId: watchBot.id });
    expect(status.status).toBe("running");
    expect(status.watchBotId).toBe(watchBot.id);
  });

  it("moves and resizes cards without re-requiring provenance", async () => {
    const { a, canvas } = await seedOwned();
    const youtube = await a.createCard({
      canvasId: canvas.id,
      type: "youtube",
      payload: { provenance },
    });
    const moved = await a.moveCard({
      cardId: youtube.id,
      position: { x: 12, y: 24 },
    });
    expect(moved.position).toEqual({ x: 12, y: 24 });
    expect(moved.payload).toEqual({ provenance });
    const resized = await a.resizeCard({
      cardId: youtube.id,
      size: { width: 320, height: 180 },
    });
    expect(resized.size).toEqual({ width: 320, height: 180 });
  });
});
