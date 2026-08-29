import { ACTION_CATALOG, type ActionName, type JsonSchema } from "./actions";

/**
 * Single WebMCP tool map from Issue #1.
 * snake_case tool name → camelCase domain action.
 * Tools not listed are out of scope. No demo-only tools.
 */
export const WEBMCP_TOOL_TO_ACTION = {
  get_canvas_state: "getCanvasState",
  create_canvas: "createCanvas",
  switch_canvas: "switchCanvas",
  create_card: "createCard",
  move_card: "moveCard",
  resize_card: "resizeCard",
  create_frame: "createFrame",
  fullscreen_frame: "fullscreenFrame",
  create_watchbot: "createWatchBot",
  update_watchbot: "updateWatchBot",
  pause_watchbot: "pauseWatchBot",
  resume_watchbot: "resumeWatchBot",
  get_watchbot_status: "getWatchBotStatus",
} as const satisfies Record<string, ActionName>;

export type WebMcpToolName = keyof typeof WEBMCP_TOOL_TO_ACTION;

export const WEBMCP_TOOL_NAMES = Object.keys(
  WEBMCP_TOOL_TO_ACTION,
) as WebMcpToolName[];

const READ_ONLY_ACTIONS = new Set<ActionName>([
  "getCanvasState",
  "getWatchBotStatus",
  "fullscreenFrame",
]);

export type WebMcpToolDefinition = {
  name: WebMcpToolName;
  actionName: (typeof WEBMCP_TOOL_TO_ACTION)[WebMcpToolName];
  description: string;
  inputSchema: JsonSchema;
  annotations: { readOnlyHint: boolean };
};

export function isWebMcpToolName(value: string): value is WebMcpToolName {
  return Object.prototype.hasOwnProperty.call(WEBMCP_TOOL_TO_ACTION, value);
}

/** 1:1 snake_case wrappers. Schemas come from ACTION_CATALOG, not a second catalog. */
export function listWebMcpTools(): WebMcpToolDefinition[] {
  return WEBMCP_TOOL_NAMES.map((name) => {
    const actionName = WEBMCP_TOOL_TO_ACTION[name];
    const action = ACTION_CATALOG[actionName];
    return {
      name,
      actionName,
      description: action.description,
      inputSchema: action.inputSchema,
      annotations: { readOnlyHint: READ_ONLY_ACTIONS.has(actionName) },
    };
  });
}
