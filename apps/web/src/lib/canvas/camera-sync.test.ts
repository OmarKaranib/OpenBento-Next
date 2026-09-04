import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shouldApplyStoredViewport } from "./camera-sync";

describe("canvas camera sync", () => {
  it("does not fitView or setViewport just because revision changed", () => {
    expect(
      shouldApplyStoredViewport({
        previousCanvasId: "c1",
        nextCanvasId: "c1",
        previousFullscreenActive: false,
        fullscreenActive: false,
        revisionChanged: true,
      }),
    ).toBe("keep");
  });

  it("restores on canvas switch and fits only in fullscreen", () => {
    expect(
      shouldApplyStoredViewport({
        previousCanvasId: "c1",
        nextCanvasId: "c2",
        fullscreenActive: false,
        revisionChanged: false,
      }),
    ).toBe("restore");
    expect(
      shouldApplyStoredViewport({
        previousCanvasId: "c1",
        nextCanvasId: "c1",
        fullscreenActive: true,
        revisionChanged: true,
      }),
    ).toBe("fit");
    expect(
      shouldApplyStoredViewport({
        previousCanvasId: "c1",
        nextCanvasId: "c1",
        previousFullscreenActive: true,
        fullscreenActive: false,
        revisionChanged: false,
      }),
    ).toBe("restore");
  });

  it("CanvasRoot camera effect does not depend on snapshot.revision", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../components/canvas/CanvasRoot.tsx"),
      "utf8",
    );
    expect(source).toContain("shouldApplyStoredViewport");
    expect(source).toContain("revision is intentionally omitted");
    expect(source).toMatch(
      /canvas\?\.id,[\s\S]*fitBounds,[\s\S]*fullscreen\?\.active,[\s\S]*fullscreen\?\.frameId,[\s\S]*primaryFrame,[\s\S]*setViewport/,
    );
    expect(source).not.toMatch(
      /shouldApplyStoredViewport[\s\S]{0,400}snapshot\.revision/,
    );
  });
});
