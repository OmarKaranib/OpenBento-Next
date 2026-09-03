import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ACTION_NAMES, type Card } from "@openbento/domain";
import { describe, expect, it } from "vitest";
import { CanvasContextMenu } from "@/components/canvas/CanvasContextMenu";
import { cardNodeId, frameNodeId } from "@/components/canvas/flow-ids";
import {
  cardSourceHref,
  clampMenuPosition,
  clientToFlowPosition,
  contextMenuCatalogActions,
  contextMenuItems,
  frameBoundsAtPoint,
  isKnownActionName,
  preventBrowserContextMenu,
  resolveContextMenuTarget,
  shouldCloseContextMenu,
} from "./context-menu";

const here = dirname(fileURLToPath(import.meta.url));

function sourceCard(sourceUrl: string): Card {
  return {
    id: "card-1",
    canvasId: "canvas-1",
    position: { x: 0, y: 0 },
    size: { width: 280, height: 180 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    type: "article",
    payload: {
      provenance: {
        sourceUrl,
        title: "Story",
        publishedAt: "",
        sourceType: "web",
      },
    },
  };
}

function noteCard(): Card {
  return {
    id: "note-1",
    canvasId: "canvas-1",
    position: { x: 0, y: 0 },
    size: { width: 240, height: 160 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    type: "note",
    payload: { text: "hello" },
  };
}

describe("canvas context menu", () => {
  it("prevents the browser default menu", () => {
    let prevented = false;
    preventBrowserContextMenu({
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(prevented).toBe(true);
  });

  it("resolves Canvas / Card / Frame variants", () => {
    expect(resolveContextMenuTarget(undefined)).toEqual({ variant: "canvas" });
    expect(resolveContextMenuTarget(cardNodeId("c9"))).toEqual({
      variant: "card",
      cardId: "c9",
    });
    expect(resolveContextMenuTarget(frameNodeId("f3"))).toEqual({
      variant: "frame",
      frameId: "f3",
    });
  });

  it("lists Canvas items and disables undo/redo from session flags", () => {
    const items = contextMenuItems({
      target: { variant: "canvas" },
      canUndo: false,
      canRedo: true,
    });
    expect(items.map((item) => item.id)).toEqual([
      "add-note",
      "create-frame",
      "new-watchbot",
      "undo",
      "redo",
      "fit-view",
    ]);
    expect(items.find((item) => item.id === "undo")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "redo")?.disabled).toBe(false);
    expect(items.some((item) => item.id === "open-source")).toBe(false);
    expect(items.some((item) => item.label === "Delete")).toBe(false);
  });

  it("shows Open Source only for safe http(s) provenance URLs", () => {
    expect(cardSourceHref(sourceCard("https://example.com/story"))).toBe(
      "https://example.com/story",
    );
    expect(cardSourceHref(sourceCard("javascript:alert(1)"))).toBeNull();
    expect(
      cardSourceHref(sourceCard("data:text/html,<script>alert(1)</script>")),
    ).toBeNull();
    expect(cardSourceHref(noteCard())).toBeNull();

    const safe = contextMenuItems({
      target: { variant: "card", cardId: "card-1" },
      canUndo: true,
      canRedo: false,
      sourceHref: cardSourceHref(sourceCard("https://example.com/story")),
    });
    expect(safe.map((item) => item.id)).toEqual(["open-source"]);

    const unsafe = contextMenuItems({
      target: { variant: "card", cardId: "card-1" },
      canUndo: true,
      canRedo: false,
      sourceHref: cardSourceHref(sourceCard("javascript:alert(1)")),
    });
    expect(unsafe.some((item) => item.id === "open-source")).toBe(false);
  });

  it("exposes Fullscreen Frame on the Frame variant", () => {
    const items = contextMenuItems({
      target: { variant: "frame", frameId: "f1" },
      canUndo: false,
      canRedo: false,
    });
    expect(items.map((item) => item.id)).toEqual(["fullscreen-frame"]);
    expect(items[0]?.actionName).toBe("fullscreenFrame");
  });

  it("converts pointer coords under pan and zoom", () => {
    const world = clientToFlowPosition(
      { x: 300, y: 220 },
      { x: 40, y: -20, zoom: 2 },
      { x: 10, y: 20 },
    );
    expect(world).toEqual({ x: 125, y: 110 });
    const bounds = frameBoundsAtPoint(world);
    expect(bounds.x).toBe(125);
    expect(bounds.y).toBe(110);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });

  it("clamps the menu inside the viewport", () => {
    expect(
      clampMenuPosition(
        { x: 900, y: 700 },
        { width: 200, height: 180 },
        { width: 1000, height: 800 },
      ),
    ).toEqual({ x: 800, y: 620 });
    expect(
      clampMenuPosition(
        { x: -40, y: -10 },
        { width: 180, height: 120 },
        { width: 400, height: 300 },
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it("closes on Escape and outside pointer down", () => {
    expect(shouldCloseContextMenu({ type: "keydown", key: "Escape" })).toBe(
      true,
    );
    expect(shouldCloseContextMenu({ type: "pointerdown" })).toBe(true);
    expect(shouldCloseContextMenu({ type: "keydown", key: "ArrowDown" })).toBe(
      false,
    );
  });

  it("renders ARIA menu / menuitem markup", () => {
    const html = renderToStaticMarkup(
      createElement(CanvasContextMenu, {
        state: {
          clientX: 12,
          clientY: 24,
          items: contextMenuItems({
            target: { variant: "canvas" },
            canUndo: true,
            canRedo: false,
          }),
        },
        onClose: () => undefined,
        onAction: () => undefined,
      }),
    );
    expect(html).toContain('role="menu"');
    expect(html).toContain('role="menuitem"');
    expect(html).toContain("Add Note here");
    expect(html).toContain("Create Frame here");
    expect(html).toContain("New WatchBot");
    expect(html).toContain("Fit view");
    expect(html).not.toContain("Delete");
  });

  it("does not invent ACTION_NAMES", () => {
    expect(ACTION_NAMES).toHaveLength(20);
    expect(ACTION_NAMES).not.toContain("deleteCard");
    expect(ACTION_NAMES).not.toContain("deleteFrame");
    for (const name of contextMenuCatalogActions()) {
      expect(isKnownActionName(name)).toBe(true);
    }
    const source = readFileSync(join(here, "context-menu.ts"), "utf8");
    expect(source).not.toMatch(/deleteCard|deleteFrame/);
    const root = readFileSync(
      join(here, "../../components/canvas/CanvasRoot.tsx"),
      "utf8",
    );
    expect(root).toContain("onPaneContextMenu");
    expect(root).toContain("preventBrowserContextMenu");
    expect(root).toContain("openWatchBotCreate");
    expect(root).not.toMatch(/deleteCard|deleteFrame/);
    expect(root).not.toMatch(/supabase\.channel|realtime/i);
  });
});
