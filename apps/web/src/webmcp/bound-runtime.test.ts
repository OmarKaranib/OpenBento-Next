import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryDomainStore,
  WEBMCP_TOOL_NAMES,
  type ActionName,
  type WebMcpToolEvent,
} from "@openbento/domain";
import { requestAuthFromVerifiedUser } from "../server/session";
import { getDomainStore, resetDomainStore, setDomainStore } from "../server/store";
import { createBoundWebMcpRuntime } from "./bound-runtime";

afterEach(() => {
  resetDomainStore();
});

function sessionRuntime(ownerId = "session-user") {
  setDomainStore(new InMemoryDomainStore());
  const events: WebMcpToolEvent[] = [];
  const catalog: ActionName[] = [];
  const runtime = createBoundWebMcpRuntime({
    request: requestAuthFromVerifiedUser(ownerId),
    onToolEvent: (event) => {
      events.push(event);
    },
    onCatalogCall: (name) => {
      catalog.push(name);
    },
  });
  return { store: getDomainStore(), runtime, events, catalog };
}

describe("WebMCP binds to runBoundAction + requireOwnerIdFromRequest", () => {
  it("fails closed when the request has no owner", async () => {
    const runtime = createBoundWebMcpRuntime();
    await expect(
      runtime.invoke("create_canvas", { name: "No session" }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("writes through getDomainStore shared with Canvas", async () => {
    const { runtime, store } = sessionRuntime("session-user");
    const canvas = await runtime.invoke("create_canvas", { name: "Shared" });
    expect(await store.getCanvas(canvas.id)).toMatchObject({
      name: "Shared",
      ownerId: "session-user",
    });
    expect(store).toBe(getDomainStore());
  });

  it("keeps Stock creation on generic create_card without adding a quote tool", async () => {
    const { runtime } = sessionRuntime();
    const canvas = await runtime.invoke("create_canvas", { name: "Markets" });
    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "chart",
      payload: {
        kind: "stock",
        symbol: "AAPL",
        price: 214.5,
        currency: "USD",
        asOf: "2026-09-04T00:00:00.000Z",
      },
    });
    expect(card).toMatchObject({ type: "chart", payload: { kind: "stock", symbol: "AAPL" } });
    expect(WEBMCP_TOOL_NAMES).toHaveLength(15);
    expect(WEBMCP_TOOL_NAMES).not.toContain("get_stock_quote");
  });

  it("stamps ownerId from the session, never from tool arguments", async () => {
    const { runtime, events, catalog } = sessionRuntime("session-user");
    const canvas = await runtime.invoke("create_canvas", { name: "From session" });
    expect(canvas.ownerId).toBe("session-user");

    catalog.length = 0;
    await expect(
      runtime.invoke("create_canvas", {
        name: "Poison",
        ownerId: "attacker",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(catalog).toEqual([]);
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
    expect(runtime.toolNames).not.toContain("delete_canvas");
    expect(runtime.toolNames).not.toContain("delete_card");
    expect(runtime.toolNames).not.toContain("delete_frame");
    expect(runtime.toolNames).not.toContain("set_card_frame");
    expect(runtime.toolNames).not.toContain("create_frame");
    expect(runtime.toolNames).not.toContain("update_frame");
    expect(runtime.toolNames).not.toContain("move_frame");
    expect(runtime.toolNames).not.toContain("resize_frame");
  });

  it("invokes every registered tool through the session-bound executor", async () => {
    const { runtime } = sessionRuntime("session-user");
    const canvas = await runtime.invoke("create_canvas", { name: "Story" });
    expect(canvas.ownerId).toBe("session-user");

    await runtime.invoke("rename_canvas", {
      canvasId: canvas.id,
      name: "Renamed Story",
    });
    await runtime.invoke("switch_canvas", { canvasId: canvas.id });
    await runtime.invoke("update_canvas_viewport", {
      canvasId: canvas.id,
      viewport: { x: 120, y: -40, zoom: 1.25 },
    });

    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "bounds only" },
      position: { x: 20, y: 20 },
      size: { width: 80, height: 60 },
    });
    expect(card.frameId).toBe(canvas.primaryFrameId);

    await runtime.invoke("update_card", {
      cardId: card.id,
      type: "note",
      payload: { text: "updated bounds only" },
    });

    await runtime.invoke("move_card", {
      cardId: card.id,
      position: { x: 24, y: 24 },
    });
    await runtime.invoke("resize_card", {
      cardId: card.id,
      size: { width: 90, height: 70 },
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
      frameId: canvas.primaryFrameId,
      active: true,
    });
    expect(view.active).toBe(true);

    await expect(
      runtime.invoke("create_watchbot", { canvasId: canvas.id }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("rejects extra frameId on create_card tool input", async () => {
    const { runtime, catalog, store } = sessionRuntime();
    const canvas = await runtime.invoke("create_canvas", { name: "No fold-in" });
    catalog.length = 0;
    await expect(
      runtime.invoke("create_card", {
        canvasId: canvas.id,
        type: "note",
        payload: { text: "no fold-in" },
        frameId: "frame-from-tool",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(catalog).toEqual([]);
    expect(await store.listCardsByCanvas(canvas.id)).toEqual([]);
  });

  it("routes safe parity actions through the authoritative executor without geometry follow-up", async () => {
    const { runtime, catalog } = sessionRuntime();
    const canvas = await runtime.invoke("create_canvas", { name: "Original" });
    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "Original card" },
    });
    catalog.length = 0;

    const renamed = await runtime.invoke("rename_canvas", {
      canvasId: canvas.id,
      name: "Renamed",
    });
    const viewport = await runtime.invoke("update_canvas_viewport", {
      canvasId: canvas.id,
      viewport: { x: 40, y: 60, zoom: 1.5 },
    });
    const updatedCard = await runtime.invoke("update_card", {
      cardId: card.id,
      type: "note",
      payload: { text: "Updated card" },
    });
    expect(renamed.name).toBe("Renamed");
    expect(viewport.viewport).toEqual({ x: 40, y: 60, zoom: 1.5 });
    expect(updatedCard.payload).toEqual({ text: "Updated card" });
    expect(catalog).toEqual([
      "renameCanvas",
      "updateCanvasViewport",
      "updateCard",
    ]);
  });
});

describe("invoke applies setCardFrame follow-up from geometry", () => {
  it("create_card then setCardFrame through the same runBoundAction execute", async () => {
    const { runtime, catalog, store } = sessionRuntime();
    const canvas = await runtime.invoke("create_canvas", { name: "Membership" });
    const frameId = canvas.primaryFrameId;
    catalog.length = 0;

    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "inside" },
      position: { x: 10, y: 10 },
      size: { width: 40, height: 40 },
    });

    expect(catalog).toEqual(["createCard", "getCanvasState", "setCardFrame"]);
    expect(card.frameId).toBe(frameId);
    expect((await store.getCard(card.id))?.frameId).toBe(frameId);
  });

  it("move_card then setCardFrame when geometry enters a frame", async () => {
    const { runtime, catalog } = sessionRuntime();
    const canvas = await runtime.invoke("create_canvas", { name: "Move" });
    const frameId = canvas.primaryFrameId;
    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "outside" },
      position: { x: 1700, y: 1000 },
      size: { width: 40, height: 40 },
    });
    expect(card.frameId).toBeNull();
    catalog.length = 0;

    const moved = await runtime.invoke("move_card", {
      cardId: card.id,
      position: { x: 12, y: 12 },
    });
    expect(catalog).toEqual(["moveCard", "getCanvasState", "setCardFrame"]);
    expect(moved.frameId).toBe(frameId);
  });

  it("resize_card then setCardFrame when geometry leaves a frame", async () => {
    const { runtime, catalog } = sessionRuntime();
    const canvas = await runtime.invoke("create_canvas", { name: "Resize" });
    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "fit" },
      position: { x: 1500, y: 800 },
      size: { width: 40, height: 40 },
    });
    expect(card.frameId).not.toBeNull();
    catalog.length = 0;

    const resized = await runtime.invoke("resize_card", {
      cardId: card.id,
      size: { width: 200, height: 200 },
    });
    expect(catalog).toEqual(["resizeCard", "getCanvasState", "setCardFrame"]);
    expect(resized.frameId).toBeNull();
  });
});

describe("fullscreen_frame is view-only", () => {
  it("does not rewrite stored geometry on fullscreen_frame", async () => {
    const { runtime, store } = sessionRuntime();
    const canvas = await runtime.invoke("create_canvas", { name: "View" });
    const frameId = canvas.primaryFrameId;
    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "stay" },
      position: { x: 16, y: 20 },
      size: { width: 50, height: 40 },
    });
    const beforeFrame = await store.getFrame(frameId);
    const beforeCard = await store.getCard(card.id);

    await runtime.invoke("fullscreen_frame", {
      frameId,
      active: true,
    });
    await runtime.invoke("fullscreen_frame", {
      frameId,
      active: false,
    });

    expect(await store.getFrame(frameId)).toEqual(beforeFrame);
    expect(await store.getCard(card.id)).toEqual(beforeCard);
  });
});
