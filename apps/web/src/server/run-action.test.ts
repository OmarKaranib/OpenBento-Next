import { ACTION_NAMES, InMemoryDomainStore } from "@openbento/domain";
import { describe, expect, it } from "vitest";
import { runBoundAction, runDomainActionFromRequest } from "./run-action";
import { requestAuthFromVerifiedUser } from "./session";

describe("session-bound server wrappers", () => {
  it("uses the session owner and ignores a client-supplied ownerId", async () => {
    const store = new InMemoryDomainStore();
    const canvas = await runBoundAction(
      { getOwnerId: async () => "session-user", store },
      "createCanvas",
      { name: "From session" },
    );
    expect(canvas.ownerId).toBe("session-user");

    await expect(
      runBoundAction(
        { getOwnerId: async () => "session-user", store },
        "createCanvas",
        { name: "Poison", ownerId: "attacker" } as never,
      ),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("fails unauthenticated requests before the executor runs", async () => {
    const store = new InMemoryDomainStore();
    await expect(
      runDomainActionFromRequest(
        { cookies: { get: () => undefined } },
        "createCanvas",
        { name: "Nope" },
        { store },
      ),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("binds authenticated requests to the request session owner", async () => {
    const store = new InMemoryDomainStore();
    const canvas = await runDomainActionFromRequest(
      requestAuthFromVerifiedUser("cookie-owner"),
      "createCanvas",
      { name: "Mine" },
      { store },
    );
    expect(canvas.ownerId).toBe("cookie-owner");

    await expect(
      runDomainActionFromRequest(
        requestAuthFromVerifiedUser("cookie-owner"),
        "createCanvas",
        { name: "Poison", ownerId: "attacker" } as never,
        { store },
      ),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("keeps two concurrent request owners isolated", async () => {
    const store = new InMemoryDomainStore();
    const [a, b] = await Promise.all([
      runDomainActionFromRequest(
        requestAuthFromVerifiedUser("owner-alpha"),
        "createCanvas",
        { name: "A" },
        { store },
      ),
      runDomainActionFromRequest(
        requestAuthFromVerifiedUser("owner-bravo"),
        "createCanvas",
        { name: "B" },
        { store },
      ),
    ]);
    expect(a.ownerId).toBe("owner-alpha");
    expect(b.ownerId).toBe("owner-bravo");
    await expect(
      runDomainActionFromRequest(
        requestAuthFromVerifiedUser("owner-bravo"),
        "getCanvasState",
        { canvasId: a.id },
        { store },
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("covers every catalog action through the same runner", async () => {
    expect(ACTION_NAMES).toHaveLength(23);
    const store = new InMemoryDomainStore();
    const deps = { getOwnerId: async () => "session-user", store };
    const canvas = await runBoundAction(deps, "createCanvas", { name: "N" });
    const card = await runBoundAction(deps, "createCard", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "t" },
    });
    const frame = await runBoundAction(deps, "createFrame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 20, height: 20 },
    });
    const bot = await runBoundAction(deps, "createWatchBot", {
      canvasId: canvas.id,
      instruction: "Watch",
    });

    await runBoundAction(deps, "renameCanvas", {
      canvasId: canvas.id,
      name: "Renamed",
    });
    await runBoundAction(deps, "switchCanvas", { canvasId: canvas.id });
    await runBoundAction(deps, "updateCanvasViewport", {
      canvasId: canvas.id,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    await runBoundAction(deps, "updateCard", {
      cardId: card.id,
      type: "note",
      payload: { text: "u" },
    });
    await runBoundAction(deps, "moveCard", {
      cardId: card.id,
      position: { x: 1, y: 1 },
    });
    await runBoundAction(deps, "resizeCard", {
      cardId: card.id,
      size: { width: 30, height: 30 },
    });
    await runBoundAction(deps, "setCardFrame", {
      cardId: card.id,
      frameId: frame.id,
    });
    await runBoundAction(deps, "updateFrame", {
      frameId: frame.id,
      name: "F",
    });
    await runBoundAction(deps, "moveFrame", {
      frameId: frame.id,
      position: { x: 2, y: 2 },
    });
    await runBoundAction(deps, "resizeFrame", {
      frameId: frame.id,
      size: { width: 40, height: 40 },
    });
    await runBoundAction(deps, "updateWatchBot", {
      watchBotId: bot.id,
      name: "Bot",
    });
    await runBoundAction(deps, "pauseWatchBot", { watchBotId: bot.id });
    await runBoundAction(deps, "resumeWatchBot", { watchBotId: bot.id });
    const state = await runBoundAction(deps, "getCanvasState", {
      canvasId: canvas.id,
    });
    expect(state.canvas.ownerId).toBe("session-user");
    await runBoundAction(deps, "getWatchBotStatus", { watchBotId: bot.id });
    const view = await runBoundAction(deps, "fullscreenFrame", {
      frameId: frame.id,
      active: true,
    });
    expect(view.active).toBe(true);
    await runBoundAction(deps, "deleteFrame", { frameId: frame.id });
    await runBoundAction(deps, "deleteCard", { cardId: card.id });
    await runBoundAction(deps, "deleteCanvas", { canvasId: canvas.id });
  });
});
