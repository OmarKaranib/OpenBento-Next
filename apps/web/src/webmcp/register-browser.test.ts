import { describe, expect, it, vi } from "vitest";
import { WEBMCP_TOOL_NAMES, createWebMcpRuntime } from "@openbento/domain";
import { registerOpenBentoWebMcpTools } from "./register-browser";
import { getModelContext, type ModelContext } from "./model-context";

describe("WebMCP browser registerTool", () => {
  it("registers only the Issue #1 snake_case tools", async () => {
    const names: string[] = [];
    const modelContext: ModelContext = {
      registerTool: (tool) => {
        names.push(tool.name);
      },
    };
    const invoke = vi.fn(async () => ({ ok: true }));
    const runtime = createWebMcpRuntime({
      execute: async () => {
        throw new Error("register must not execute");
      },
    });
    const registered = await registerOpenBentoWebMcpTools(
      { tools: runtime.tools, invoke },
      { modelContext },
    );
    expect(registered).toEqual([...WEBMCP_TOOL_NAMES]);
    expect(names).toEqual([...WEBMCP_TOOL_NAMES]);
    expect(names).not.toContain("echo");
    expect(names).not.toContain("hello_world");
  });

  it("forwards execute to the provided invoke (session-bound server action)", async () => {
    let execute: ((args: Record<string, unknown>) => Promise<unknown>) | undefined;
    const modelContext: ModelContext = {
      registerTool: (tool) => {
        if (tool.name === "create_canvas") {
          execute = tool.execute;
        }
      },
    };
    const invoke = vi.fn(async () => ({ id: "c1" }));
    const runtime = createWebMcpRuntime({
      execute: async () => {
        throw new Error("browser host must not call executor directly");
      },
    });
    await registerOpenBentoWebMcpTools(
      { tools: runtime.tools, invoke },
      { modelContext },
    );
    await execute?.({ name: "Agent canvas" });
    expect(invoke).toHaveBeenCalledWith("create_canvas", { name: "Agent canvas" });
  });

  it("registers nothing when modelContext is missing", async () => {
    const runtime = createWebMcpRuntime({
      execute: async () => {
        throw new Error("unused");
      },
    });
    const registered = await registerOpenBentoWebMcpTools(runtime, {
      modelContext: null,
    });
    expect(registered).toEqual([]);
  });

  it("feature-detects an ordinary browser without modelContext", () => {
    expect(getModelContext({})).toBeNull();
  });

  it("deduplicates concurrent and repeated lifecycle registrations", async () => {
    const names: string[] = [];
    const modelContext: ModelContext = {
      registerTool: async (tool) => {
        names.push(tool.name);
      },
    };
    const runtime = createWebMcpRuntime({
      execute: async () => {
        throw new Error("browser host must not call executor directly");
      },
    });
    const input = {
      tools: runtime.tools,
      invoke: vi.fn(async () => ({ ok: true })),
    };

    const [first, second] = await Promise.all([
      registerOpenBentoWebMcpTools(input, { modelContext }),
      registerOpenBentoWebMcpTools(input, { modelContext }),
    ]);
    const third = await registerOpenBentoWebMcpTools(input, { modelContext });

    expect(first).toEqual([...WEBMCP_TOOL_NAMES]);
    expect(second).toEqual([...WEBMCP_TOOL_NAMES]);
    expect(third).toEqual([]);
    expect(names).toEqual([...WEBMCP_TOOL_NAMES]);
  });

  it("can retry after a registration failure without duplicating successful tools", async () => {
    const names: string[] = [];
    let shouldFail = true;
    const modelContext: ModelContext = {
      registerTool: async (tool) => {
        if (tool.name === "create_card" && shouldFail) {
          throw new Error("host registration unavailable");
        }
        names.push(tool.name);
      },
    };
    const runtime = createWebMcpRuntime({
      execute: async () => {
        throw new Error("browser host must not call executor directly");
      },
    });
    const input = {
      tools: runtime.tools,
      invoke: vi.fn(async () => ({ ok: true })),
    };

    await expect(
      registerOpenBentoWebMcpTools(input, { modelContext }),
    ).rejects.toThrow("host registration unavailable");
    shouldFail = false;

    const retried = await registerOpenBentoWebMcpTools(input, { modelContext });
    expect(retried).toEqual([
      "create_card",
      ...WEBMCP_TOOL_NAMES.slice(WEBMCP_TOOL_NAMES.indexOf("create_card") + 1),
    ]);
    expect(names).toEqual([...WEBMCP_TOOL_NAMES]);
  });
});
