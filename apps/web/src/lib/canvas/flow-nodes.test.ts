import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Card, Column, Frame } from "@openbento/domain";
import {
  cardMatchesMonitorFilter,
  emptyMonitorFilter,
} from "./card-search";
import { nodesFromSnapshot } from "./flow-nodes";

const here = dirname(fileURLToPath(import.meta.url));

const noteA: Extract<Card, { type: "note" }> = {
  id: "note-a",
  canvasId: "canvas-1",
  position: { x: 16, y: 32 },
  size: { width: 240, height: 160 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  type: "note",
  payload: { text: "Lake Ontario briefing" },
};

const articleB: Card = {
  id: "article-b",
  canvasId: "canvas-1",
  position: { x: 400, y: 80 },
  size: { width: 280, height: 180 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  type: "article",
  payload: {
    provenance: {
      sourceUrl: "https://example.com/story",
      title: "Official statement",
      publishedAt: "",
      sourceType: "web",
    },
  },
};

const frame: Frame = {
  id: "frame-1",
  canvasId: "canvas-1",
  name: "Evidence",
  bounds: { x: 0, y: 0, width: 800, height: 600 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const activeColumn: Column = {
  id: "column-active",
  canvasId: "canvas-1",
  frameId: frame.id,
  name: "Live feed",
  bounds: { x: 40, y: 80, width: 300, height: 400 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const parkedColumn: Column = {
  ...activeColumn,
  id: "column-parked",
  bounds: { x: 700, y: 80, width: 300, height: 400 },
};

describe("presentation-only Canvas filter projection", () => {
  it("hides unmatched Cards and keeps Frame nodes and stored geometry", () => {
    const cards = [noteA, articleB];
    const before = structuredClone(cards);
    const filter = { ...emptyMonitorFilter(), query: "ontario" };
    const nodes = nodesFromSnapshot(cards, [frame], [], null, {
      cardVisible: (card) =>
        cardMatchesMonitorFilter(card, filter, new Set()),
    });

    expect(nodes.map((node) => node.id)).toEqual([
      "frame:frame-1",
      "card:note-a",
    ]);
    const noteNode = nodes.find((node) => node.id === "card:note-a");
    expect(noteNode?.position).toEqual({ x: 16, y: 32 });
    expect(noteNode?.style).toEqual({ width: 240, height: 160 });
    expect(cards).toEqual(before);
    expect(noteA.position).toEqual({ x: 16, y: 32 });
    expect(articleB.position).toEqual({ x: 400, y: 80 });
    expect(articleB.frameId).toBeUndefined();
  });

  it("clearing the filter restores every Card at original positions", () => {
    const cards = [noteA, articleB];
    const hidden = nodesFromSnapshot(cards, [frame], [], null, {
      cardVisible: () => false,
    });
    expect(hidden.filter((node) => node.id.startsWith("card:"))).toHaveLength(0);
    expect(hidden.map((node) => node.id)).toEqual(["frame:frame-1"]);

    const restored = nodesFromSnapshot(cards, [frame], [], null);
    expect(restored.map((node) => node.id)).toEqual([
      "frame:frame-1",
      "card:note-a",
      "card:article-b",
    ]);
    expect(restored.find((node) => node.id === "card:article-b")?.position).toEqual(
      { x: 400, y: 80 },
    );
  });

  it("does not call geometry or membership actions", () => {
    const source = readFileSync(join(here, "flow-nodes.ts"), "utf8");
    expect(source).not.toMatch(
      /moveCard|resizeCard|updateCard|setCardFrame|execute\(/,
    );
  });

  it("projects active and parked Columns as draggable without rendering stream Cards twice", () => {
    const columnCard = { ...noteA, id: "stream-card", columnId: activeColumn.id };
    const nodes = nodesFromSnapshot(
      [noteA, columnCard],
      [frame],
      [activeColumn, parkedColumn],
      null,
    );

    expect(nodes.map((node) => node.id)).toEqual([
      "frame:frame-1",
      "column:column-active",
      "column:column-parked",
      "card:note-a",
    ]);
    expect(nodes.find((node) => node.id === "column:column-active")).toMatchObject({
      draggable: true,
      selectable: true,
      data: { parked: false },
    });
    expect(nodes.find((node) => node.id === "column:column-parked")).toMatchObject({
      draggable: true,
      selectable: true,
      className: "is-parked",
      data: { parked: true },
    });
  });

  it("fullscreen hides parked space but keeps active Cards and Columns interactive", () => {
    const parkedCard = { ...articleB, position: { x: 900, y: 80 } };
    const nodes = nodesFromSnapshot(
      [noteA, parkedCard],
      [frame],
      [activeColumn, parkedColumn],
      { frameId: frame.id, canvasId: frame.canvasId, active: true },
    );

    expect(nodes.map((node) => node.id)).toEqual([
      "frame:frame-1",
      "column:column-active",
      "card:note-a",
    ]);
    expect(nodes[0]).toMatchObject({ draggable: false, selectable: false });
    expect(nodes[1]).toMatchObject({ draggable: true, selectable: true });
    expect(nodes[2]).toMatchObject({ draggable: true, selectable: true });
  });

  it("keeps Column overflow bounded and locks only the fullscreen camera", () => {
    const columnSource = readFileSync(
      join(here, "../../components/canvas/nodes/ColumnNode.tsx"),
      "utf8",
    );
    const canvasSource = readFileSync(
      join(here, "../../components/canvas/CanvasRoot.tsx"),
      "utf8",
    );
    expect(columnSource).toContain("min-h-0 flex-1");
    expect(columnSource).toContain("overflow-y-auto");
    expect(columnSource).toContain("overscroll-contain");
    expect(canvasSource).toContain("panOnDrag={fullscreenActive ? false : [0]}");
    expect(canvasSource).toContain("panOnScroll={!fullscreenActive}");
    expect(canvasSource).toContain("zoomOnScroll={!fullscreenActive}");
    expect(canvasSource).toContain("proOptions={{ hideAttribution: true }}");
  });
});
