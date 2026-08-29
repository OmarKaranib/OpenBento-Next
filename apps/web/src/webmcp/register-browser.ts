import {
  listWebMcpTools,
  type WebMcpRuntime,
  type WebMcpToolName,
} from "@openbento/domain";
import { getModelContext, type ModelContext } from "./model-context";

/**
 * 1:1 snake_case `registerTool` wrappers. execute must already be bound to
 * `runBoundAction` + `requireSessionOwnerId` (see `runWebMcpTool`).
 */
export async function registerOpenBentoWebMcpTools(
  runtime: Pick<WebMcpRuntime, "tools" | "invoke">,
  options?: { signal?: AbortSignal; modelContext?: ModelContext | null },
): Promise<WebMcpToolName[]> {
  const ctx =
    options && "modelContext" in options
      ? (options.modelContext ?? null)
      : getModelContext();
  if (!ctx) {
    return [];
  }
  const registered: WebMcpToolName[] = [];
  for (const tool of runtime.tools) {
    await ctx.registerTool(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        execute: (args) => runtime.invoke(tool.name, args ?? {}),
      },
      { signal: options?.signal },
    );
    registered.push(tool.name);
  }
  return registered;
}

export function webMcpToolNamesForHost(): WebMcpToolName[] {
  return listWebMcpTools().map((tool) => tool.name);
}
