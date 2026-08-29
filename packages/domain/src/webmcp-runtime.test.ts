import { describe, expect, it } from "vitest";
import { ACTION_CATALOG, ACTION_NAMES } from "./actions";
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
    expect(tools).toHaveLength(13);
    for (const tool of tools) {
      expect(ACTION_NAMES).toContain(tool.actionName);
      expect(tool.actionName).toBe(WEBMCP_TOOL_TO_ACTION[tool.name]);
      expect(tool.inputSchema).toBe(ACTION_CATALOG[tool.actionName].inputSchema);
      expect(tool.description).toBe(ACTION_CATALOG[tool.actionName].description);
      expect(tool.inputSchema.properties).not.toHaveProperty("ownerId");
    }
  });

  it("does not register demo or extra tools", () => {
    const tools = listWebMcpTools();
    expect(tools.map((tool) => tool.name)).toEqual([...WEBMCP_TOOL_NAMES]);
    for (const name of DEMO_TOOL_NAMES) {
      expect(tools.map((tool) => tool.name)).not.toContain(name);
    }
    expect(tools.map((tool) => tool.name)).not.toContain("set_card_frame");
    expect(tools.map((tool) => tool.name)).not.toContain("rename_canvas");
  });
});

describe("WebMCP wrapper rejects poisoned and unknown tools", () => {
  it("rejects ownerId on tool arguments via the injected execute", async () => {
    const executor = createActionExecutor({
      store: new InMemoryDomainStore(),
      ownerId: "session-from-caller",
    });
    const runtime = createWebMcpRuntime({
      execute: (name, input) => executor.execute(name, input),
    });
    await expect(
      runtime.invoke("create_canvas", {
        name: "Stolen",
        ownerId: "attacker",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
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
});
