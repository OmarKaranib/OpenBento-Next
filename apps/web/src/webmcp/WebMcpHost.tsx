"use client";

import { listWebMcpTools } from "@openbento/domain";
import { useEffect } from "react";
import { runWebMcpTool } from "./actions";
import { registerOpenBentoWebMcpTools } from "./register-browser";

/**
 * Registers Issue #1 tools on `document.modelContext`.
 * Each execute calls `runWebMcpTool` → `runBoundAction` +
 * `requireOwnerIdFromRequest` with `getDomainStore()`.
 */
export function WebMcpHost() {
  const tools = listWebMcpTools();

  useEffect(() => {
    const registered = listWebMcpTools();
    void registerOpenBentoWebMcpTools(
      {
        tools: registered,
        invoke: (toolName, input) => runWebMcpTool(toolName, input),
      },
    ).catch(() => {
      // WebMCP is optional in ordinary browsers. A host registration failure
      // must not prevent the human Canvas from rendering or recovering.
    });
  }, []);

  return (
    <p className="sr-only" data-testid="webmcp-host">
      WebMCP tools: {tools.map((tool) => tool.name).join(", ")}
    </p>
  );
}
