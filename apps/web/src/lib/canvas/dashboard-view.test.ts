import { describe, expect, it } from "vitest";
import type { Canvas, Frame } from "@openbento/domain";
import { CANVAS_VIEW_TOOL_IDS } from "@/components/canvas/CanvasToolbar";
import {
  dashboardFitRequest,
  dashboardFullscreenInput,
  primaryDashboardFrame,
} from "./dashboard-view";

const canvas: Canvas = {
  id: "canvas",
  ownerId: "owner",
  primaryFrameId: "primary",
  name: "Dashboard",
  viewport: { x: 0, y: 0, zoom: 1 },
  createdAt: "2026-09-04T00:00:00.000Z",
  updatedAt: "2026-09-04T00:00:00.000Z",
};

const primary: Frame = {
  id: "primary",
  canvasId: canvas.id,
  name: "Dashboard",
  bounds: { x: 0, y: 0, width: 1600, height: 900 },
  createdAt: canvas.createdAt,
  updatedAt: canvas.updatedAt,
};

describe("dashboard view controls", () => {
  it("targets only the declared primary Frame for fit and return", () => {
    const parkedLegacyFrame = {
      ...primary,
      id: "parked-object-that-must-not-affect-fit",
      bounds: { x: 9000, y: 9000, width: 5000, height: 5000 },
    };
    const frame = primaryDashboardFrame({
      currentCanvasId: canvas.id,
      canvases: [canvas],
      frames: [parkedLegacyFrame, primary],
      fullscreen: null,
    });
    expect(frame).toBe(primary);
    expect(dashboardFitRequest(frame!, "fit")).toEqual({
      bounds: primary.bounds,
      options: { padding: 0.06, duration: 200 },
    });
    expect(dashboardFitRequest(frame!, "return")).toEqual({
      bounds: primary.bounds,
      options: { padding: 0.14, duration: 240 },
    });
  });

  it("toggles fullscreen for the primary dashboard", () => {
    expect(dashboardFullscreenInput(primary, null)).toEqual({
      frameId: primary.id,
      active: true,
    });
    expect(
      dashboardFullscreenInput(primary, {
        frameId: primary.id,
        canvasId: canvas.id,
        active: true,
      }),
    ).toEqual({ frameId: primary.id, active: false });
  });

  it("keeps the bottom-left toolbar view-only and ordered", () => {
    expect(CANVAS_VIEW_TOOL_IDS).toEqual([
      "zoom-in",
      "zoom-out",
      "fit-dashboard",
      "return-dashboard",
      "fullscreen-dashboard",
      "snap",
      "undo",
      "redo",
    ]);
    expect(CANVAS_VIEW_TOOL_IDS).not.toContain("column");
  });
});
