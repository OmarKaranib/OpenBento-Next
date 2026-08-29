import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryDomainStore,
  WEBMCP_TOOL_NAMES,
  applyCardFrameFromGeometry,
  type WebMcpToolEvent,
} from "@openbento/domain";
import { configureAuthSession, resetAuthSession } from "../server/session";
import { resetDomainStore } from "../server/store";
import {
  createBoundWebMcpRuntime,
  createSessionBoundExecute,
} from "./bound-runtime";

afterEach(() => {
  resetAuthSession();
  resetDomainStore();
});

function sessionRuntime(ownerId = "session-user") {
  configureAuthSession({
    getOwnerId: async () => ownerId,
  });
  const store = new InMemoryDomainStore();
  const events: WebMcpToolEvent[] = [];
  const runtime = createBoundWebMcpRuntime({
    store,
    onToolEvent: (event) => {
      events.push(event);
    },
  });
  const execute = createSessionBoundExecute(store);
  return { store, runtime, execute, events };
}

describe("WebMCP binds to runBoundAction + requireSessionOwnerId", () => {
  it("fails closed when the session port has no owner", async () => {
    const runtime = createBoundWebMcpRuntime({
      store: new InMemoryDomainStore(),
    });
    await expect(
      runtime.invoke("create_canvas", { name: "No session" }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("stamps ownerId from the session, never from tool arguments", async () => {
    const { runtime, events } = sessionRuntime("session-user");
    const canvas = await runtime.invoke("create_canvas", { name: "From session" });
    expect(canvas.ownerId).toBe("session-user");

    await expect(
      runtime.invoke("create_canvas", {
        name: "Poison",
        ownerId: "attacker",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(events.at(-1)).toMatchObject({
      name: "ob.webmcp.tool",
      toolName: "create_canvas",
      success: false,
    });
  });

  it("does not register demo tools", () => {
    const { runtime } = sessionRuntime();
    expect(runtime.toolNames).toEqual([...WEBMCP_TOOL_NAMES]);
    expect(runtime.toolNames).not.toContain("echo");
    expect(runtime.toolNames).not.toContain("hello_world");
  });

  it("invokes every registered tool through the session-bound executor", async () => {
    const { runtime } = sessionRuntime("session-user");
    const canvas = await runtime.invoke("create_canvas", { name: "Story" });
    expect(canvas.ownerId).toBe("session-user");

    await runtime.invoke("switch_canvas", { canvasId: canvas.id });

    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "bounds only" },
      position: { x: 20, y: 20 },
      size: { width: 80, height: 60 },
    });
    expect(card.frameId).toBeNull();

    await runtime.invoke("move_card", {
      cardId: card.id,
      position: { x: 24, y: 24 },
    });
    await runtime.invoke("resize_card", {
      cardId: card.id,
      size: { width: 90, height: 70 },
    });

    const frame = await runtime.invoke("create_frame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 400, height: 300 },
      name: "Main",
    });

    const bot = await runtime.invoke("create_watchbot", {
      canvasId: canvas.id,
      instruction: "Monitor meaningful developments",
    });
    expect(bot.ownerId).toBe("session-user");
    expect(bot.status).toBe("running");

    await runtime.invoke("update_watchbot", {
      watchBotId: bot.id,
      name: "Story bot",
    });
    await runtime.invoke("pause_watchbot", { watchBotId: bot.id });
    await runtime.invoke("resume_watchbot", { watchBotId: bot.id });
    const status = await runtime.invoke("get_watchbot_status", {
      watchBotId: bot.id,
    });
    expect(status.status).toBe("running");

    const state = await runtime.invoke("get_canvas_state", {
      canvasId: canvas.id,
    });
    expect(state.canvas.ownerId).toBe("session-user");
    expect(state.cards).toHaveLength(1);
    expect(state.frames).toHaveLength(1);

    const view = await runtime.invoke("fullscreen_frame", {
      frameId: frame.id,
      active: true,
    });
    expect(view.active).toBe(true);

    await expect(
      runtime.invoke("create_card", {
        canvasId: canvas.id,
        type: "note",
        payload: { text: "no fold-in" },
        frameId: frame.id,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });

    await expect(
      runtime.invoke("create_watchbot", { canvasId: canvas.id }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("keeps create_card bounds-only then setCardFrame from geometry via runBoundAction", async () => {
    const { runtime, execute } = sessionRuntime();
    const canvas = await runtime.invoke("create_canvas", { name: "Membership" });
    const frame = await runtime.invoke("create_frame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 200, height: 200 },
      name: "Inner",
    });
    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "inside" },
      position: { x: 10, y: 10 },
      size: { width: 40, height: 40 },
    });
    expect(card.frameId).toBeNull();

    const member = await applyCardFrameFromGeometry(execute, card, [frame]);
    expect(member.frameId).toBe(frame.id);
  });

  it("does not rewrite stored geometry on fullscreen_frame", async () => {
    const { runtime, store } = sessionRuntime();
    const canvas = await runtime.invoke("create_canvas", { name: "View" });
    const frame = await runtime.invoke("create_frame", {
      canvasId: canvas.id,
      bounds: { x: 8, y: 12, width: 220, height: 180 },
    });
    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "stay" },
      position: { x: 16, y: 20 },
      size: { width: 50, height: 40 },
    });
    const beforeFrame = await store.getFrame(frame.id);
    const beforeCard = await store.getCard(card.id);

    await runtime.invoke("fullscreen_frame", {
      frameId: frame.id,
      active: true,
    });
    await runtime.invoke("fullscreen_frame", {
      frameId: frame.id,
      active: false,
    });

    expect(await store.getFrame(frame.id)).toEqual(beforeFrame);
    expect(await store.getCard(card.id)).toEqual(beforeCard);
  });
});
