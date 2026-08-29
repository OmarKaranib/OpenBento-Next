"use client";

import { listWebMcpTools } from "@openbento/domain";
import { useEffect } from "react";
import { runWebMcpTool } from "./actions";
import { registerOpenBentoWebMcpTools } from "./register-browser";

/**
 * Registers Issue #1 tools on `document.modelContext`.
 * Each execute calls `runWebMcpTool` → `runBoundAction` + `requireSessionOwnerId`.
 * Does not use WorkspaceSession / LOCAL_SESSION_OWNER_ID.
 */
export function WebMcpHost() {
  const tools = listWebMcpTools();

  useEffect(() => {
    const controller = new AbortController();
    const registered = listWebMcpTools();
    void registerOpenBentoWebMcpTools(
      {
        tools: registered,
        invoke: (toolName, input) => runWebMcpTool(toolName, input),
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, []);

  return (
    <p className="sr-only" data-testid="webmcp-host">
      WebMCP tools: {tools.map((tool) => tool.name).join(", ")}
    </p>
  );
}
