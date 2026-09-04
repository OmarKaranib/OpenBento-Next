import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    snapshot: {
      frames: [{ id: "dashboard", name: "Dashboard" }],
      fullscreen: null,
    },
  }),
}));

import { FrameNode } from "./FrameNode";

describe("FrameNode dashboard surface", () => {
  it("renders a boundary only, without a Frame name editor or duplicate fullscreen control", () => {
    const html = renderToStaticMarkup(
      createElement(FrameNode, {
        id: "frame-dashboard",
        type: "frame",
        data: { frameId: "dashboard" },
        selected: false,
        dragging: false,
        zIndex: 0,
        isConnectable: false,
        positionAbsoluteX: 0,
        positionAbsoluteY: 0,
      } as never),
    );
    expect(html).toContain("data-dashboard-surface");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Fullscreen Frame");
  });
});
