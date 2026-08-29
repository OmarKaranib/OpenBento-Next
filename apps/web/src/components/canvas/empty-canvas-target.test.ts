import { describe, expect, it } from "vitest";
import {
  canvasDoubleClickShouldCreateNote,
  isEmptyCanvasPointerTarget,
} from "./empty-canvas-target";

function target(flags: {
  pane?: boolean;
  node?: boolean;
  handle?: boolean;
  edge?: boolean;
}): EventTarget {
  return {
    closest(selector: string) {
      if (flags.node && selector.includes(".react-flow__node")) return this;
      if (flags.handle && selector.includes(".react-flow__handle")) return this;
      if (flags.edge && selector.includes(".react-flow__edge")) return this;
      if (flags.pane && selector.includes(".react-flow__pane")) return this;
      return null;
    },
  } as EventTarget;
}

describe("empty canvas double-click target", () => {
  it("accepts the pane and Background children, not nodes", () => {
    expect(isEmptyCanvasPointerTarget(target({ pane: true }))).toBe(true);
    expect(isEmptyCanvasPointerTarget(target({ pane: true, node: true }))).toBe(
      false,
    );
    expect(isEmptyCanvasPointerTarget(target({ node: true }))).toBe(false);
    expect(isEmptyCanvasPointerTarget(target({ handle: true, pane: true }))).toBe(
      false,
    );
    expect(isEmptyCanvasPointerTarget(null)).toBe(false);
    expect(isEmptyCanvasPointerTarget({} as EventTarget)).toBe(false);
  });

  it("creates a Note only when the pane is writable", () => {
    const pane = target({ pane: true });
    expect(
      canvasDoubleClickShouldCreateNote({
        target: pane,
        readOnly: false,
        frameToolActive: false,
      }),
    ).toBe(true);
    expect(
      canvasDoubleClickShouldCreateNote({
        target: pane,
        readOnly: true,
        frameToolActive: false,
      }),
    ).toBe(false);
    expect(
      canvasDoubleClickShouldCreateNote({
        target: pane,
        readOnly: false,
        frameToolActive: true,
      }),
    ).toBe(false);
  });
});
