import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nextRailPanel, type RailPanel } from "./workspace-ui";

const here = dirname(fileURLToPath(import.meta.url));
const shellRoot = join(here, "../shell");

describe("rail panel state", () => {
  it("opens an inactive section", () => {
    expect(nextRailPanel(null, "canvases")).toBe("canvases");
  });

  it("replaces the current section when another one is selected", () => {
    expect(nextRailPanel("canvases", "watchbots")).toBe("watchbots");
  });

  it("closes the active section when selected again", () => {
    expect(nextRailPanel("settings", "settings")).toBeNull();
  });

  it("supports the panel close action", () => {
    const closeRequest: RailPanel = null;
    expect(nextRailPanel("canvases", closeRequest)).toBeNull();
  });

  it("uses settings for the account control", () => {
    expect(nextRailPanel(null, "settings")).toBe("settings");
  });

  it("wires the close and account controls to those shared semantics", () => {
    const sidePanels = readFileSync(join(shellRoot, "SidePanels.tsx"), "utf8");
    const leftRail = readFileSync(join(shellRoot, "LeftRail.tsx"), "utf8");

    expect(sidePanels).toContain("onClick={() => setRailPanel(null)}");
    expect(leftRail).toContain('onClick={() => toggleRailPanel("settings")}');
    expect(leftRail).toContain('aria-label="Account and settings"');
  });
});
