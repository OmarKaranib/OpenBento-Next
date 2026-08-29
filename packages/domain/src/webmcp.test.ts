import { describe, expect, it } from "vitest";
import { ACTION_NAMES } from "./actions";
import { WEBMCP_TOOL_TO_ACTION } from "./webmcp";

describe("WebMCP tool map", () => {
  it("is only the Issue #1 snake_case to camelCase map", () => {
    expect(WEBMCP_TOOL_TO_ACTION).toEqual({
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
    });
  });

  it("maps every tool onto an existing domain action", () => {
    for (const action of Object.values(WEBMCP_TOOL_TO_ACTION)) {
      expect(ACTION_NAMES).toContain(action);
    }
  });
});
