import type { ActionName } from "./actions";

/**
 * Single WebMCP tool map from Issue #1.
 * snake_case tool name → camelCase domain action.
 * Tools not listed are out of scope.
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
