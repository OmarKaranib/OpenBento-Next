import { describe, expect, it } from "vitest";
import { ACTION_NAMES } from "./actions";
import { WEBMCP_TOOL_TO_ACTION } from "./webmcp";

describe("WebMCP tool map", () => {
  it("is exactly the safe snake_case to camelCase map", () => {
    expect(WEBMCP_TOOL_TO_ACTION).toEqual({
      get_canvas_state: "getCanvasState",
      create_canvas: "createCanvas",
      rename_canvas: "renameCanvas",
      switch_canvas: "switchCanvas",
      update_canvas_viewport: "updateCanvasViewport",
      create_card: "createCard",
      update_card: "updateCard",
      move_card: "moveCard",
      resize_card: "resizeCard",
      fullscreen_frame: "fullscreenFrame",
      create_watchbot: "createWatchBot",
      update_watchbot: "updateWatchBot",
      pause_watchbot: "pauseWatchBot",
      resume_watchbot: "resumeWatchBot",
      get_watchbot_status: "getWatchBotStatus",
    });
  });

  it("excludes destructive actions and direct Frame membership", () => {
    expect(WEBMCP_TOOL_TO_ACTION).not.toHaveProperty("delete_canvas");
    expect(WEBMCP_TOOL_TO_ACTION).not.toHaveProperty("delete_card");
    expect(WEBMCP_TOOL_TO_ACTION).not.toHaveProperty("delete_frame");
    expect(WEBMCP_TOOL_TO_ACTION).not.toHaveProperty("set_card_frame");
    expect(WEBMCP_TOOL_TO_ACTION).not.toHaveProperty("create_frame");
    expect(WEBMCP_TOOL_TO_ACTION).not.toHaveProperty("update_frame");
    expect(WEBMCP_TOOL_TO_ACTION).not.toHaveProperty("move_frame");
    expect(WEBMCP_TOOL_TO_ACTION).not.toHaveProperty("resize_frame");
    expect(WEBMCP_TOOL_TO_ACTION).toHaveProperty(
      "fullscreen_frame",
      "fullscreenFrame",
    );
  });

  it("maps every tool onto an existing domain action", () => {
    for (const action of Object.values(WEBMCP_TOOL_TO_ACTION)) {
      expect(ACTION_NAMES).toContain(action);
    }
  });
});
