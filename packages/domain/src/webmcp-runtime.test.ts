import { describe, expect, it } from "vitest";
import { ACTION_CATALOG, ACTION_NAMES } from "./actions";
import { DomainError } from "./errors";
import { createActionExecutor } from "./executor";
import { InMemoryDomainStore } from "./store";
import { createWebMcpRuntime } from "./webmcp-runtime";
import {
  WEBMCP_TOOL_NAMES,
  WEBMCP_TOOL_TO_ACTION,
  listWebMcpTools,
} from "./webmcp";

const DEMO_TOOL_NAMES = [
  "echo",
  "hello_world",
  "hello-world",
  "ping",
  "get_time",
];

describe("WebMCP registered tools", () => {
  it("maps every registered tool onto a real ACTION_CATALOG action", () => {
    const tools = listWebMcpTools();
    expect(tools.map((tool) => tool.name)).toEqual([...WEBMCP_TOOL_NAMES]);
    expect(tools).toHaveLength(19);
    for (const tool of tools) {
      expect(ACTION_NAMES).toContain(tool.actionName);
      expect(tool.actionName).toBe(WEBMCP_TOOL_TO_ACTION[tool.name]);
      expect(tool.inputSchema).toBe(ACTION_CATALOG[tool.actionName].inputSchema);
      expect(tool.description).toBe(ACTION_CATALOG[tool.actionName].description);
      expect(tool.inputSchema.properties).not.toHaveProperty("ownerId");
    }
  });

  it("does not register demo, destructive, or direct-membership tools", () => {
    const tools = listWebMcpTools();
    expect(tools.map((tool) => tool.name)).toEqual([...WEBMCP_TOOL_NAMES]);
    for (const name of DEMO_TOOL_NAMES) {
      expect(tools.map((tool) => tool.name)).not.toContain(name);
    }
    expect(tools.map((tool) => tool.name)).not.toContain("set_card_frame");
    expect(tools.map((tool) => tool.name)).not.toContain("delete_canvas");
    expect(tools.map((tool) => tool.name)).not.toContain("delete_card");
    expect(tools.map((tool) => tool.name)).not.toContain("delete_frame");
  });

  it("sets supported Chrome annotations from result semantics", () => {
    const readOnly = new Set([
      "get_canvas_state",
      "get_watchbot_status",
      "fullscreen_frame",
    ]);

    for (const tool of listWebMcpTools()) {
      expect(tool.annotations).toEqual({
        readOnlyHint: readOnly.has(tool.name),
        untrustedContentHint: tool.name !== "fullscreen_frame",
      });
    }
  });
});

describe("WebMCP wrapper rejects poisoned and unknown tools", () => {
  it("rejects ownerId on tool arguments before dispatch", async () => {
    const dispatched: string[] = [];
    const runtime = createWebMcpRuntime({
      execute: async (name) => {
        dispatched.push(name);
        throw new Error("should not run");
      },
    });
    await expect(
      runtime.invoke("create_canvas", {
        name: "Stolen",
        ownerId: "attacker",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(dispatched).toEqual([]);
  });

  it("rejects frameId on create_card tool input", async () => {
    const dispatched: string[] = [];
    const runtime = createWebMcpRuntime({
      execute: async (name) => {
        dispatched.push(name);
        throw new Error("should not run");
      },
    });
    await expect(
      runtime.invoke("create_card", {
        canvasId: "c1",
        type: "note",
        payload: { text: "no" },
        frameId: "frame-1",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(dispatched).toEqual([]);
  });

  it("rejects unknown and demo tool names without dispatching", async () => {
    const dispatched: string[] = [];
    const runtime = createWebMcpRuntime({
      execute: async (name) => {
        dispatched.push(name);
        throw new Error("should not run");
      },
    });
    await expect(
      runtime.invoke("echo" as never, { message: "hi" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(dispatched).toEqual([]);
  });

  it("returns stable safe errors instead of storage implementation details", async () => {
    const runtime = createWebMcpRuntime({
      execute: async () => {
        throw new Error("PostgREST: SUPABASE_SERVICE_ROLE_KEY=not-for-agents");
      },
    });

    await expect(
      runtime.invoke("create_canvas", { name: "Safe failure" }),
    ).rejects.toEqual(
      new DomainError(
        "conflict",
        "OpenBento could not complete the requested tool action.",
      ),
    );
  });

  it("keeps expected domain error codes while removing implementation messages", async () => {
    const runtime = createWebMcpRuntime({
      execute: async () => {
        throw new DomainError("invalid_input", "database relation details");
      },
    });

    await expect(
      runtime.invoke("create_canvas", { name: "Safe domain failure" }),
    ).rejects.toEqual(
      new DomainError("invalid_input", "The tool input is invalid."),
    );
  });

  it("emits telemetry without tool inputs or secrets", async () => {
    const events: unknown[] = [];
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "session-user" });
    const runtime = createWebMcpRuntime({
      execute: (name, input) => executor.execute(name, input),
      onToolEvent: (event) => events.push(event),
    });

    const canvas = await runtime.invoke("create_canvas", {
      name: "secret-body-value",
    });

    expect(events).toEqual([
      {
        name: "ob.webmcp.tool",
        toolName: "create_canvas",
        success: true,
        canvasId: canvas.id,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("secret-body-value");
    expect(events[0]).not.toHaveProperty("input");
    expect(events[0]).not.toHaveProperty("arguments");
  });
});

describe("WebMCP invoke follows up setCardFrame from geometry", () => {
  it("runs createCard then setCardFrame after invoke(create_card)", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "session-from-caller" });
    const catalog: string[] = [];
    const runtime = createWebMcpRuntime({
      execute: (name, input) => executor.execute(name, input),
      onCatalogCall: (name) => {
        catalog.push(name);
      },
    });
    const canvas = await runtime.invoke("create_canvas", { name: "Story" });
    const frame = await runtime.invoke("create_frame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 200, height: 200 },
      name: "Inner",
    });
    catalog.length = 0;

    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "inside" },
      position: { x: 10, y: 10 },
      size: { width: 40, height: 40 },
    });

    expect(catalog).toEqual(["createCard", "getCanvasState", "setCardFrame"]);
    expect(card.frameId).toBe(frame.id);
    expect((await store.getCard(card.id))?.frameId).toBe(frame.id);
  });

  it("runs moveCard then setCardFrame after invoke(move_card)", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "session-from-caller" });
    const catalog: string[] = [];
    const runtime = createWebMcpRuntime({
      execute: (name, input) => executor.execute(name, input),
      onCatalogCall: (name) => {
        catalog.push(name);
      },
    });
    const canvas = await runtime.invoke("create_canvas", { name: "Story" });
    const frame = await runtime.invoke("create_frame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 200, height: 200 },
    });
    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "outside" },
      position: { x: 400, y: 400 },
      size: { width: 40, height: 40 },
    });
    expect(card.frameId).toBeNull();
    catalog.length = 0;

    const moved = await runtime.invoke("move_card", {
      cardId: card.id,
      position: { x: 12, y: 12 },
    });
    expect(catalog).toEqual(["moveCard", "getCanvasState", "setCardFrame"]);
    expect(moved.frameId).toBe(frame.id);
  });

  it("runs resizeCard then setCardFrame after invoke(resize_card)", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "session-from-caller" });
    const catalog: string[] = [];
    const runtime = createWebMcpRuntime({
      execute: (name, input) => executor.execute(name, input),
      onCatalogCall: (name) => {
        catalog.push(name);
      },
    });
    const canvas = await runtime.invoke("create_canvas", { name: "Story" });
    await runtime.invoke("create_frame", {
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 80, height: 80 },
    });
    const card = await runtime.invoke("create_card", {
      canvasId: canvas.id,
      type: "note",
      payload: { text: "inside" },
      position: { x: 10, y: 10 },
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
