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
      bounds: { x: 0, y: 0, width: 300, height: 300 },
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
      position: { x: 800, y: 800 },
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

  it("clears membership when a Frame is moved off a member Card", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const createdFrame = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 200, height: 200 },
      name: "Main",
    });
    const member = await executor.createCard(
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        position: { x: 20, y: 20 },
        size: { width: 40, height: 40 },
        text: "Stay put",
      }),
    );
    const outsider = await executor.createCard(
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        position: { x: 400, y: 400 },
        size: { width: 40, height: 40 },
        text: "Join later",
      }),
    );
    await executor.setCardFrame({ cardId: member.id, frameId: createdFrame.id });

    const moved = await executor.moveFrame({
      frameId: createdFrame.id,
      position: { x: 380, y: 380 },
    });
    const state = await executor.getCanvasState({ canvasId: canvas.id });
    const nextFrames = state.frames.map((entry) =>
      entry.id === moved.id ? moved : entry,
    );
    const changes = membershipCallsForCards(state.cards, nextFrames);

    expect(changes).toEqual(
      expect.arrayContaining([
        { cardId: member.id, frameId: null },
        { cardId: outsider.id, frameId: createdFrame.id },
      ]),
    );
    expect(changes).toHaveLength(2);

    for (const change of changes) {
      await executor.setCardFrame(change);
    }
    const after = await executor.getCanvasState({ canvasId: canvas.id });
    expect(after.cards.find((entry) => entry.id === member.id)?.frameId ?? null).toBeNull();
    expect(after.cards.find((entry) => entry.id === outsider.id)?.frameId).toBe(
      createdFrame.id,
    );
    expect(after.cards.find((entry) => entry.id === member.id)?.position).toEqual({
      x: 20,
      y: 20,
    });
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
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    });
    await expect(
      executor.setCardFrame({ cardId: card.id, frameId: other.id }),
    ).rejects.toBeInstanceOf(SameCanvasMembershipError);
  });
});
