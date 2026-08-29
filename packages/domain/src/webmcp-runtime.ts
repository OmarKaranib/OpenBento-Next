import {
  ACTION_CATALOG,
  type ActionInputMap,
  type ActionName,
  type ActionResultMap,
} from "./actions";
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

const GEOMETRY_TOOLS = new Set<WebMcpToolName>([
  "create_card",
  "move_card",
  "resize_card",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canvasIdFromResult(result: unknown): string | undefined {
  if (!isRecord(result)) {
    return undefined;
  }
  if (typeof result.canvasId === "string") {
    return result.canvasId;
  }
  if (typeof result.id === "string" && "viewport" in result) {
    return result.id;
  }
  return undefined;
}

/** ownerId is session-derived. frameId is only valid when the mapped schema has it. */
export function assertWebMcpToolInputKeys(
  toolName: WebMcpToolName,
  input: unknown,
): void {
  if (!isRecord(input)) {
    return;
  }
  if (Object.prototype.hasOwnProperty.call(input, "ownerId")) {
    throw new DomainError(
      "invalid_input",
      "ownerId must not be supplied on tool arguments; it is session-derived",
    );
  }
  const actionName = WEBMCP_TOOL_TO_ACTION[toolName];
  const allowsFrameId = Object.prototype.hasOwnProperty.call(
    ACTION_CATALOG[actionName].inputSchema.properties,
    "frameId",
  );
  if (Object.prototype.hasOwnProperty.call(input, "frameId") && !allowsFrameId) {
    throw new DomainError(
      "invalid_input",
      "frameId is not a tool argument; membership is a follow-up setCardFrame from geometry",
    );
  }
}

/**
 * After create_card / move_card / resize_card: read frames via getCanvasState,
 * then setCardFrame from geometry. Same execute as the tool (runBoundAction).
 * Does not write frameId inside createCard.
 */
export async function followUpCardFrameFromGeometry(
  execute: WebMcpExecute,
  card: Card,
): Promise<Card> {
  const state = await execute("getCanvasState", { canvasId: card.canvasId });
  return applyCardFrameFromGeometry(execute, card, state.frames);
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
  onCatalogCall?: (name: ActionName) => void;
}): WebMcpRuntime {
  const tools = listWebMcpTools();
  const execute: WebMcpExecute = (name, input) => {
    deps.onCatalogCall?.(name);
    return deps.execute(name, input);
  };

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
      assertWebMcpToolInputKeys(toolName, input);
      let result: unknown = await execute(
        actionName,
        input as ActionInputMap[typeof actionName],
      );
      if (GEOMETRY_TOOLS.has(toolName)) {
        result = await followUpCardFrameFromGeometry(execute, result as Card);
      }
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
