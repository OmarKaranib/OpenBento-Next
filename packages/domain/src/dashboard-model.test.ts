import { describe, expect, it } from "vitest";
import {
  createActionExecutor,
  InMemoryDomainStore,
  isColumnActive,
  isFreeCardActive,
  orderColumnCardsNewestFirst,
  PRIMARY_FRAME_BOUNDS,
  selectPrimaryFrame,
  type Card,
  type Column,
  type Frame,
} from "./index";

function harness(ownerId = "owner-a") {
  const store = new InMemoryDomainStore();
  let sequence = 0;
  const executor = createActionExecutor({
    store,
    ownerId,
    now: () => `2026-09-04T00:00:0${sequence}.000Z`,
    id: () => `${ownerId}-${++sequence}`,
  });
  return { store, executor };
}

describe("singleton primary Frame", () => {
  it("creates Canvas + primary Frame atomically with stable logical bounds", async () => {
    const { executor } = harness();
    const canvas = await executor.createCanvas({ name: "Dashboard" });
    const state = await executor.getCanvasState({ canvasId: canvas.id });
    expect(state.frames).toHaveLength(1);
    expect(state.frames[0]?.id).toBe(canvas.primaryFrameId);
    expect(state.frames[0]?.bounds).toEqual(PRIMARY_FRAME_BOUNDS);
  });

  it("never creates a second Frame and rejects deletion of the primary", async () => {
    const { executor } = harness();
    const canvas = await executor.createCanvas({ name: "Dashboard" });
    const frame = await executor.createFrame({
      canvasId: canvas.id,
      bounds: PRIMARY_FRAME_BOUNDS,
      name: "Primary",
    });
    expect(frame.id).toBe(canvas.primaryFrameId);
    expect((await executor.getCanvasState({ canvasId: canvas.id })).frames).toHaveLength(1);
    await expect(executor.deleteFrame({ frameId: frame.id })).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("rejects create, move, and resize attempts that alter canonical geometry", async () => {
    const { executor } = harness();
    const canvas = await executor.createCanvas({ name: "Dashboard" });
    await expect(
      executor.createFrame({
        canvasId: canvas.id,
        bounds: { x: 10, y: 20, width: 800, height: 450 },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      executor.moveFrame({
        frameId: canvas.primaryFrameId,
        position: { x: 10, y: 20 },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      executor.resizeFrame({
        frameId: canvas.primaryFrameId,
        size: { width: 800, height: 450 },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      (await executor.getCanvasState({ canvasId: canvas.id })).frames[0]?.bounds,
    ).toEqual(PRIMARY_FRAME_BOUNDS);
  });

  it("bootstraps a legacy zero-Frame Canvas and selects legacy Frames deterministically", async () => {
    const { store, executor } = harness();
    await store.saveCanvas({
      id: "legacy",
      ownerId: "owner-a",
      primaryFrameId: "legacy-primary",
      name: "Legacy",
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const state = await executor.getCanvasState({ canvasId: "legacy" });
    expect(state.frames.map((frame) => frame.id)).toEqual(["legacy-primary"]);

    const frames: Frame[] = [
      { ...state.frames[0]!, id: "new", createdAt: "2026-02-01T00:00:00.000Z" },
      { ...state.frames[0]!, id: "old-b", createdAt: "2026-01-01T00:00:00.000Z" },
      { ...state.frames[0]!, id: "old-a", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(selectPrimaryFrame(frames)?.id).toBe("old-a");
    expect(selectPrimaryFrame(frames, "new")?.id).toBe("new");
  });

  it("normalizes a legacy primary Frame without translating Cards", async () => {
    const { store, executor } = harness();
    await store.saveCanvas({
      id: "legacy-canvas",
      ownerId: "owner-a",
      primaryFrameId: "legacy-frame",
      name: "Legacy",
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await store.saveFrame({
      id: "legacy-frame",
      canvasId: "legacy-canvas",
      name: "Old dashboard",
      bounds: { x: 99, y: 88, width: 700, height: 500 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const card = await executor.createCard({
      canvasId: "legacy-canvas",
      type: "note",
      payload: { text: "Keep me put" },
      position: { x: 1700, y: 950 },
    });

    const state = await executor.getCanvasState({ canvasId: "legacy-canvas" });
    expect(state.frames[0]?.bounds).toEqual(PRIMARY_FRAME_BOUNDS);
    expect(state.cards.find((entry) => entry.id === card.id)?.position).toEqual({
      x: 1700,
      y: 950,
    });
  });
});

describe("Column membership, ordering, and detach", () => {
  it("persists bounded Columns in the primary Frame and rejects invalid sizes", async () => {
    const { executor } = harness();
    const canvas = await executor.createCanvas({ name: "Columns" });
    const column = await executor.createColumn({ canvasId: canvas.id, name: "Live" });
    expect(column.frameId).toBe(canvas.primaryFrameId);
    await expect(
      executor.resizeColumn({ columnId: column.id, size: { width: 279, height: 320 } }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      executor.resizeColumn({ columnId: column.id, size: { width: 1201, height: 900 } }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("rejects cross-Canvas Column membership", async () => {
    const { executor } = harness();
    const first = await executor.createCanvas({ name: "First" });
    const second = await executor.createCanvas({ name: "Second" });
    const column = await executor.createColumn({ canvasId: second.id });
    const card = await executor.createCard({
      canvasId: first.id,
      type: "note",
      payload: { text: "No crossing" },
    });
    await executor.setCardFrame({ cardId: card.id, frameId: first.primaryFrameId });
    await expect(
      executor.setCardColumn({ cardId: card.id, columnId: column.id }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("fills active dashboard slots before deterministic parking slots", async () => {
    const { executor } = harness();
    const canvas = await executor.createCanvas({ name: "Slots" });
    const columns: Column[] = [];
    for (let index = 0; index < 6; index += 1) {
      columns.push(await executor.createColumn({ canvasId: canvas.id }));
    }
    expect(columns.map((column) => column.bounds)).toEqual([
      { x: 40, y: 60, width: 320, height: 780 },
      { x: 384, y: 60, width: 320, height: 780 },
      { x: 728, y: 60, width: 320, height: 780 },
      { x: 1072, y: 60, width: 320, height: 780 },
      { x: 1640, y: 60, width: 320, height: 780 },
      { x: 1984, y: 60, width: 320, height: 780 },
    ]);
    const frame = (await executor.getCanvasState({ canvasId: canvas.id })).frames[0]!;
    expect(columns.slice(0, 4).every((column) => isColumnActive(column, frame))).toBe(true);
    expect(columns.slice(4).every((column) => !isColumnActive(column, frame))).toBe(true);
  });

  it("orders newest first with a stable id tie-break", () => {
    const base: Card = {
      id: "a",
      canvasId: "canvas",
      frameId: "frame",
      columnId: "column",
      type: "note",
      payload: { text: "a" },
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
    };
    expect(
      orderColumnCardsNewestFirst([
        base,
        { ...base, id: "c", createdAt: "2026-09-04T00:00:01.000Z" },
        { ...base, id: "b" },
      ]).map((card) => card.id),
    ).toEqual(["c", "b", "a"]);
  });

  it("detaches the same Card into free Frame space without changing provenance", async () => {
    const { executor } = harness();
    const canvas = await executor.createCanvas({ name: "Pin" });
    const column = await executor.createColumn({ canvasId: canvas.id });
    const bot = await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Watch sources",
    });
    const card = await executor.createCard({
      canvasId: canvas.id,
      type: "news",
      payload: {
        provenance: {
          sourceUrl: "https://example.com/story",
          title: "Story",
          publishedAt: "",
          sourceType: "news",
          watchBotId: bot.id,
        },
      },
      position: { x: 50, y: 100 },
      size: { width: 280, height: 180 },
    });
    await executor.setCardFrame({ cardId: card.id, frameId: canvas.primaryFrameId });
    await executor.setCardColumn({ cardId: card.id, columnId: column.id });
    const detached = await executor.detachCardFromColumn({
      cardId: card.id,
      position: { x: 900, y: 300 },
    });
    expect(detached.id).toBe(card.id);
    expect(detached.columnId).toBeNull();
    expect(detached.position).toEqual({ x: 900, y: 300 });
    expect(detached.payload).toEqual(card.payload);
    expect((await executor.getCanvasState({ canvasId: canvas.id })).cards).toHaveLength(1);
    expect((await executor.getWatchBotStatus({ watchBotId: bot.id })).status).toBe("running");
  });
});

describe("active versus parked geometry", () => {
  it("uses inclusive containment and never mutates stored geometry for fullscreen", async () => {
    const { executor } = harness();
    const canvas = await executor.createCanvas({ name: "Parking" });
    const frame = (await executor.getCanvasState({ canvasId: canvas.id })).frames[0]!;
    const column = await executor.createColumn({
      canvasId: canvas.id,
      position: { x: 1280, y: 580 },
      size: { width: 320, height: 320 },
    });
    expect(isColumnActive(column, frame)).toBe(true);
    const parked = await executor.moveColumn({
      columnId: column.id,
      position: { x: 1280.001, y: 580 },
    });
    expect(isColumnActive(parked, frame)).toBe(false);

    const card = await executor.createCard({
      canvasId: canvas.id,
      type: "note",
      payload: { text: "Boundary" },
      position: { x: 1360, y: 740 },
      size: { width: 240, height: 160 },
    });
    expect(isFreeCardActive(card, frame)).toBe(true);
    const before = structuredClone(frame.bounds);
    await executor.fullscreenFrame({ frameId: frame.id, active: true });
    expect((await executor.getCanvasState({ canvasId: canvas.id })).frames[0]?.bounds).toEqual(before);
  });
});
