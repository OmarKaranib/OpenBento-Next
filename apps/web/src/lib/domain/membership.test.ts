import { describe, expect, it } from "vitest";
import {
  createActionExecutor,
  InMemoryDomainStore,
  SameCanvasMembershipError,
  selectSmallestContainingFrame,
  type Frame,
} from "@openbento/domain";
import {
  cardWorldBounds,
  membershipCallsForCards,
  planCardGeometry,
  planFrameGeometry,
  resolveCardFrameMembership,
} from "./membership";
import { buildCreateNoteCardInput } from "./note-card";

function frame(partial: {
  id: string;
  canvasId: string;
  bounds: Frame["bounds"];
  createdAt: string;
}): Frame {
  return {
    ...partial,
    name: partial.id,
    updatedAt: partial.createdAt,
  };
}

describe("Frame membership helper usage", () => {
  it("delegates geometry to selectSmallestContainingFrame and does not write frameId", () => {
    const outer = frame({
      id: "outer",
      canvasId: "canvas-a",
      bounds: { x: 0, y: 0, width: 400, height: 400 },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const inner = frame({
      id: "inner",
      canvasId: "canvas-a",
      bounds: { x: 50, y: 50, width: 100, height: 100 },
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    const bounds = cardWorldBounds({
      position: { x: 60, y: 60 },
      size: { width: 20, height: 20 },
    });

    expect(selectSmallestContainingFrame(bounds, [outer, inner])).toBe("inner");
    expect(resolveCardFrameMembership(bounds, [outer, inner])).toBe("inner");
    expect(
      resolveCardFrameMembership(
        { x: 1000, y: 1000, width: 10, height: 10 },
        [outer, inner],
      ),
    ).toBeNull();
  });

  it("breaks equal-area ties with newest createdAt", () => {
    const older = frame({
      id: "aaa-older",
      canvasId: "canvas-a",
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = frame({
      id: "zzz-newer",
      canvasId: "canvas-a",
      bounds: { x: 0, y: 0, width: 50, height: 200 },
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const bounds = cardWorldBounds({
      position: { x: 10, y: 10 },
      size: { width: 20, height: 20 },
    });
    expect(resolveCardFrameMembership(bounds, [older, newer])).toBe("zzz-newer");
  });

  it("writes membership only through setCardFrame on the shared executor", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const createdFrame = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 1600, height: 900 },
      name: "Main",
    });
    const card = await executor.createCard(
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        position: { x: 20, y: 20 },
        text: "Inside",
      }),
    );

    const state = await executor.getCanvasState({ canvasId: canvas.id });
    const join = membershipCallsForCards(state.cards, state.frames);
    expect(join).toEqual([{ cardId: card.id, frameId: createdFrame.id }]);
    const attached = await executor.setCardFrame(join[0]!);
    expect(attached.frameId).toBe(createdFrame.id);

    const moved = await executor.moveCard({
      cardId: card.id,
      position: { x: 1700, y: 1000 },
    });
    const afterMove = await executor.getCanvasState({ canvasId: canvas.id });
    const leave = membershipCallsForCards(
      [moved],
      afterMove.frames,
    );
    expect(leave).toEqual([{ cardId: card.id, frameId: null }]);
    const cleared = await executor.setCardFrame(leave[0]!);
    expect(cleared.frameId).toBeNull();
  });

  it("joins a Note created inside a Frame via setCardFrame", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const createdFrame = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 1600, height: 900 },
      name: "Main",
    });
    const card = await executor.createCard(
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        position: { x: 40, y: 40 },
        size: { width: 80, height: 60 },
        text: "Inside",
      }),
    );
    expect(card.frameId ?? null).toBeNull();

    const state = await executor.getCanvasState({ canvasId: canvas.id });
    const join = membershipCallsForCards([card], state.frames);
    expect(join).toEqual([{ cardId: card.id, frameId: createdFrame.id }]);
    const attached = await executor.setCardFrame(join[0]!);
    expect(attached.frameId).toBe(createdFrame.id);
  });

  it("NW resize that moves origin uses moveCard and remembership from the new origin", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const createdFrame = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 1600, height: 900 },
      name: "Main",
    });
    const card = await executor.createCard(
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        position: { x: 80, y: 80 },
        size: { width: 80, height: 80 },
        text: "Resize me",
      }),
    );
    await executor.setCardFrame({ cardId: card.id, frameId: createdFrame.id });
    const member = await executor.getCanvasState({ canvasId: canvas.id });
    const attached = member.cards.find((entry) => entry.id === card.id)!;
    expect(attached.frameId).toBe(createdFrame.id);

    const nextPosition = { x: 1700, y: 1000 };
    const nextSize = { width: 40, height: 40 };
    const oldOriginBounds = cardWorldBounds({
      position: attached.position,
      size: nextSize,
    });
    const newOriginBounds = cardWorldBounds({
      position: nextPosition,
      size: nextSize,
    });
    expect(resolveCardFrameMembership(oldOriginBounds, member.frames)).toBe(
      createdFrame.id,
    );
    expect(resolveCardFrameMembership(newOriginBounds, member.frames)).toBeNull();

    const plan = planCardGeometry(
      attached,
      { position: nextPosition, size: nextSize },
      member.frames,
    );
    expect(plan.move).toEqual({ cardId: card.id, position: nextPosition });
    expect(plan.resize).toEqual({ cardId: card.id, size: nextSize });
    expect(plan.membership).toEqual({ cardId: card.id, frameId: null });

    const moved = await executor.moveCard(plan.move!);
    expect(moved.position).toEqual(nextPosition);
    await executor.resizeCard(plan.resize!);
    const cleared = await executor.setCardFrame(plan.membership!);
    expect(cleared.frameId).toBeNull();
    expect(cleared.position).toEqual(nextPosition);
  });

  it("keeps legacy Frame resize planning pure while the canonical executor rejects it", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const state = await executor.getCanvasState({ canvasId: canvas.id });
    const primary = state.frames[0]!;
    const plan = planFrameGeometry(
      primary,
      { position: { x: 100, y: 100 }, size: { width: 800, height: 600 } },
      state.cards,
      state.frames,
    );

    expect(plan.move).toEqual({ frameId: primary.id, position: { x: 100, y: 100 } });
    expect(plan.resize).toEqual({ frameId: primary.id, size: { width: 800, height: 600 } });
    await expect(executor.moveFrame(plan.move!)).rejects.toMatchObject({ code: "conflict" });
    await expect(executor.resizeFrame(plan.resize!)).rejects.toMatchObject({ code: "conflict" });
    expect((await executor.getCanvasState({ canvasId: canvas.id })).frames[0]?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
    });
  });

  it("does not move the dashboard to recapture a deliberately parked Card", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const parked = await executor.createCard(
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        position: { x: 1700, y: 1000 },
        size: { width: 40, height: 40 },
        text: "Parked",
      }),
    );

    await expect(
      executor.moveFrame({
        frameId: canvas.primaryFrameId,
        position: { x: 1600, y: 900 },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const state = await executor.getCanvasState({ canvasId: canvas.id });
    expect(membershipCallsForCards([parked], state.frames)).toEqual([]);
    expect(state.cards[0]?.position).toEqual({ x: 1700, y: 1000 });
  });

  it("allows legacy createFrame only when it preserves canonical geometry", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const primary = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 1600, height: 900 },
      name: "Large",
    });
    const configured = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 1600, height: 900 },
      name: "Renamed",
    });
    const state = await executor.getCanvasState({ canvasId: canvas.id });

    expect(configured.id).toBe(primary.id);
    expect(configured.id).toBe(canvas.primaryFrameId);
    expect(configured.bounds).toEqual({ x: 0, y: 0, width: 1600, height: 900 });
    expect(configured.name).toBe("Renamed");
    expect(state.frames).toEqual([configured]);
  });

  it("rejects setCardFrame across canvases in the shared executor", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const a = await executor.createCanvas({ name: "A" });
    const b = await executor.createCanvas({ name: "B" });
    const card = await executor.createCard(
      buildCreateNoteCardInput({ canvasId: a.id, text: "x" }),
    );
    const other = await executor.createFrame({
      canvasId: b.id,
      bounds: { x: 0, y: 0, width: 1600, height: 900 },
    });
    await expect(
      executor.setCardFrame({ cardId: card.id, frameId: other.id }),
    ).rejects.toBeInstanceOf(SameCanvasMembershipError);
  });
});
