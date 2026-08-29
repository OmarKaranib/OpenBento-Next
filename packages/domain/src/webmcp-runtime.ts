import type { ActionInputMap, ActionName, ActionResultMap } from "./actions";
import { DomainError } from "./errors";
import {
  selectSmallestContainingFrame,
  type FrameContainmentCandidate,
} from "./frames";
import type { Card } from "./types";
import {
  WEBMCP_TOOL_TO_ACTION,
  isWebMcpToolName,
  listWebMcpTools,
  type WebMcpToolDefinition,
  type WebMcpToolName,
} from "./webmcp";

/**
 * Injected catalog execute. Production WebMCP binds this to
 * `runBoundAction({ getOwnerId: requireSessionOwnerId, store })` so
 * `createActionExecutor` runs inside that session path. This module does
 * not construct ownerId.
 */
export type WebMcpExecute = <K extends ActionName>(
  name: K,
  input: ActionInputMap[K],
) => Promise<ActionResultMap[K]>;

/** `ob.webmcp.tool` — toolName + success/fail only. No input bodies. */
export type WebMcpToolEvent = {
  name: "ob.webmcp.tool";
  toolName: string;
  success: boolean;
  canvasId?: string;
};

export type WebMcpRuntime = {
  tools: WebMcpToolDefinition[];
  toolNames: readonly WebMcpToolName[];
  invoke: <N extends WebMcpToolName>(
    toolName: N,
    input: unknown,
  ) => Promise<ActionResultMap[(typeof WEBMCP_TOOL_TO_ACTION)[N]]>;
};

function canvasIdFromResult(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }
  const record = result as Record<string, unknown>;
  if (typeof record.canvasId === "string") {
    return record.canvasId;
  }
  if (typeof record.id === "string" && "viewport" in record) {
    return record.id;
  }
  return undefined;
}

/**
 * Registerable WebMCP surface. Every tool is a 1:1 snake_case wrapper around
 * a catalog action. Handlers are not reimplemented here — they go through
 * the provided `execute`. Apps/web must pass `runBoundAction` +
 * `requireSessionOwnerId`. This module does not mint a session ownerId.
 */
export function createWebMcpRuntime(deps: {
  execute: WebMcpExecute;
  onToolEvent?: (event: WebMcpToolEvent) => void;
}): WebMcpRuntime {
  const tools = listWebMcpTools();

  async function invoke<N extends WebMcpToolName>(
    toolName: N,
    input: unknown,
  ): Promise<ActionResultMap[(typeof WEBMCP_TOOL_TO_ACTION)[N]]> {
    if (!isWebMcpToolName(toolName)) {
      deps.onToolEvent?.({
        name: "ob.webmcp.tool",
        toolName: String(toolName),
        success: false,
      });
      throw new DomainError(
        "invalid_input",
        `Unknown WebMCP tool ${String(toolName)}`,
      );
    }
    const actionName = WEBMCP_TOOL_TO_ACTION[toolName];
    try {
      const result = await deps.execute(
        actionName,
        input as ActionInputMap[typeof actionName],
      );
      deps.onToolEvent?.({
        name: "ob.webmcp.tool",
        toolName,
        success: true,
        canvasId: canvasIdFromResult(result),
      });
      return result as ActionResultMap[(typeof WEBMCP_TOOL_TO_ACTION)[N]];
    } catch (error) {
      deps.onToolEvent?.({
        name: "ob.webmcp.tool",
        toolName,
        success: false,
      });
      throw error;
    }
  }

  return {
    tools,
    toolNames: tools.map((tool) => tool.name),
    invoke,
  };
}

/**
 * Frame membership is a follow-up `setCardFrame` from geometry.
 * Never fold this into `createCard`. Not a registered WebMCP tool —
 * `set_card_frame` is not on the Issue #1 map. Callers must pass the
 * same session-bound execute as the tools (runBoundAction).
 */
export async function applyCardFrameFromGeometry(
  execute: WebMcpExecute,
  card: Pick<Card, "id" | "position" | "size">,
  frames: ReadonlyArray<FrameContainmentCandidate>,
) {
  const frameId = selectSmallestContainingFrame(
    {
      x: card.position.x,
      y: card.position.y,
      width: card.size.width,
      height: card.size.height,
    },
    frames,
  );
  return execute("setCardFrame", { cardId: card.id, frameId });
}
