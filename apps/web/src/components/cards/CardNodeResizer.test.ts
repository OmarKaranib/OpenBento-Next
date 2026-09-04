import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Card } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";

const { box } = vi.hoisted(() => ({
  box: {
    fullscreen: false,
    nodeResizerProps: {} as Record<string, unknown>,
    beginInteraction: vi.fn(),
    endInteraction: vi.fn(async () => undefined),
    persistCardGeometry: vi.fn(async () => undefined),
  },
}));

vi.mock("@xyflow/react", () => ({
  NodeResizer: (props: Record<string, unknown>) => {
    box.nodeResizerProps = props;
    return createElement("div", { "data-node-resizer": true });
  },
}));

vi.mock("@/components/workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    snapshot: { fullscreen: box.fullscreen ? { active: true } : null },
    session: {
      beginInteraction: box.beginInteraction,
      endInteraction: box.endInteraction,
    },
  }),
}));

vi.mock("@/components/canvas/use-canvas-commands", () => ({
  useCanvasCommands: () => ({
    persistCardGeometry: box.persistCardGeometry,
  }),
}));

import { CardNodeResizer } from "./CardNodeResizer";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../..");

const card = {
  id: "source-card",
  canvasId: "canvas-1",
  position: { x: 10, y: 20 },
  size: { width: 280, height: 180 },
  createdAt: "2026-09-03T12:00:00.000Z",
  updatedAt: "2026-09-03T12:00:00.000Z",
  type: "article",
  payload: {
    provenance: {
      sourceUrl: "https://example.com/story",
      title: "Story",
      publishedAt: "",
      sourceType: "web",
    },
  },
} as Card;

function renderResizer(selected: boolean): void {
  renderToStaticMarkup(
    createElement(CardNodeResizer, {
      card,
      selected,
      minWidth: 200,
      minHeight: 120,
    }),
  );
}

describe("shared Card resize controls", () => {
  it("shows visible, discoverable, non-panning handles only when selected", () => {
    box.fullscreen = false;
    renderResizer(true);
    expect(box.nodeResizerProps).toMatchObject({
      isVisible: true,
      minWidth: 200,
      minHeight: 120,
      color: "#818cf8",
    });
    expect(box.nodeResizerProps.handleClassName).toContain("nodrag nopan");
    expect(box.nodeResizerProps.lineClassName).toContain("nodrag nopan");

    renderResizer(false);
    expect(box.nodeResizerProps.isVisible).toBe(false);
  });

  it("hides handles in fullscreen/read-only mode", () => {
    box.fullscreen = true;
    renderResizer(true);
    expect(box.nodeResizerProps.isVisible).toBe(false);
    box.fullscreen = false;
  });

  it("persists through the existing geometry path and interaction lifecycle", async () => {
    box.beginInteraction.mockClear();
    box.endInteraction.mockClear();
    box.persistCardGeometry.mockClear();
    renderResizer(true);

    const onResizeStart = box.nodeResizerProps.onResizeStart as () => void;
    const onResizeEnd = box.nodeResizerProps.onResizeEnd as (
      event: unknown,
      params: { x: number; y: number; width: number; height: number },
    ) => void;
    onResizeStart();
    onResizeEnd(null, { x: 30, y: 40, width: 420, height: 300 });

    expect(box.beginInteraction).toHaveBeenCalledOnce();
    expect(box.persistCardGeometry).toHaveBeenCalledWith(card, {
      position: { x: 30, y: 40 },
      size: { width: 420, height: 300 },
    });
    await vi.waitFor(() => expect(box.endInteraction).toHaveBeenCalledOnce());
  });

  it("keeps every Card type on the shared unclipped resizer path", () => {
    const chrome = readFileSync(join(webSrc, "components/cards/SourceCardChrome.tsx"), "utf8");
    const note = readFileSync(join(webSrc, "components/canvas/nodes/NoteCardNode.tsx"), "utf8");
    const sourceNodes = readFileSync(join(webSrc, "components/canvas/nodes/ArticleCardNode.tsx"), "utf8");
    const youtube = readFileSync(join(webSrc, "components/canvas/nodes/YoutubeCardNode.tsx"), "utf8");
    const x = readFileSync(join(webSrc, "components/canvas/nodes/XCardNode.tsx"), "utf8");

    expect(chrome.indexOf("<CardNodeResizer")).toBeLessThan(
      chrome.indexOf("data-card-visual-shell"),
    );
    expect(chrome).toContain('className="relative h-full w-full overflow-visible"');
    expect(chrome).toMatch(/data-card-visual-shell[\s\S]*overflow-hidden/);
    expect(note).toContain("<CardNodeResizer");
    expect(note).toMatch(/data-card-visual-shell[\s\S]*overflow-hidden/);
    expect(sourceNodes).toContain('"article" | "web" | "news"');
    expect(sourceNodes.match(/<SourceLinkBody/g)).toHaveLength(3);
    expect(youtube).toContain("<SourceCardChrome");
    expect(youtube).toContain("aspect-video");
    expect(x).toContain("<SourceCardChrome");
  });
});
