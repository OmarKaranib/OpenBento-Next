import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card, Column } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";

const { box } = vi.hoisted(() => ({
  box: {
    cards: [] as Card[],
    columns: [] as Column[],
    execute: vi.fn(async () => undefined),
  },
}));

vi.mock("@xyflow/react", () => ({
  NodeResizer: () => createElement("div", { "data-node-resizer": true }),
}));

vi.mock("@/components/workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    snapshot: { columns: box.columns, cards: box.cards, watchBots: [] },
    execute: box.execute,
    session: {
      beginInteraction: vi.fn(),
      endInteraction: vi.fn(async () => undefined),
    },
  }),
}));

vi.mock("@/components/canvas/use-canvas-commands", () => ({
  useCanvasCommands: () => ({ persistColumnResize: vi.fn(async () => undefined) }),
}));

import {
  COLUMN_CARD_DRAG_TYPE,
  ColumnNode,
  setColumnCardDragData,
} from "./ColumnNode";

const column: Column = {
  id: "column",
  canvasId: "canvas",
  frameId: "frame",
  name: "X feed",
  bounds: { x: 40, y: 60, width: 320, height: 780 },
  createdAt: "2026-09-04T00:00:00.000Z",
  updatedAt: "2026-09-04T00:00:00.000Z",
};

const provenance = {
  sourceUrl: "https://x.com/openbento/status/123",
  title: "Legacy X post",
  publishedAt: "2026-09-04T12:00:00.000Z",
  sourceType: "x" as const,
  author: "openbento",
};

function renderColumn(card: Card): string {
  box.columns = [column];
  box.cards = [card];
  return renderToStaticMarkup(
    createElement(ColumnNode, {
      data: { columnId: column.id, parked: false },
      selected: false,
    } as never),
  );
}

function xCard(payload: Extract<Card, { type: "x" }>["payload"]): Card {
  return {
    id: "x-column-card",
    canvasId: column.canvasId,
    frameId: column.frameId,
    columnId: column.id,
    position: { x: 52, y: 112 },
    size: { width: 296, height: 180 },
    type: "x",
    payload,
    createdAt: "2026-09-04T12:01:00.000Z",
    updatedAt: "2026-09-04T12:01:00.000Z",
  };
}

describe("Column X feed tiles", () => {
  it("reuses rich X presentation with image, playable video, metrics, and source", () => {
    const html = renderColumn(
      xCard({
        provenance,
        postText: "A rich X update",
        authorDisplayName: "OpenBento News",
        username: "openbento",
        authorAvatarUrl: "https://pbs.twimg.com/profile_images/42/avatar.jpg",
        metrics: { replyCount: 3, repostCount: 9, likeCount: 1_200 },
        media: [
          {
            mediaKey: "image",
            type: "photo",
            url: "https://pbs.twimg.com/media/photo.jpg",
          },
          {
            mediaKey: "video",
            type: "video",
            previewImageUrl: "https://pbs.twimg.com/media/poster.jpg",
            playbackUrl: "https://video.twimg.com/media/playback.mp4",
          },
        ],
      }),
    );

    expect(html).toContain('data-x-card-variant="column"');
    expect(html).toContain("OpenBento News");
    expect(html).toContain("@openbento");
    expect(html).toContain("photo.jpg");
    expect(html).toContain("<video");
    expect(html).toContain("playback.mp4");
    expect(html).toContain("controls");
    expect(html).toContain("Likes: 1200");
    expect(html).toContain('href="https://x.com/openbento/status/123"');
  });

  it("keeps the old provenance-only payload as a compact fallback", () => {
    const html = renderColumn(xCard({ provenance }));
    expect(html).toContain("Legacy X post");
    expect(html).toContain("@openbento");
    expect(html).not.toContain("data-x-media-count");
  });

  it("does not turn an unsafe X source into a link", () => {
    const html = renderColumn(
      xCard({ provenance: { ...provenance, sourceUrl: "javascript:alert(1)" } }),
    );
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });

  it("makes only the visible handle draggable and writes detach drag data", () => {
    const html = renderColumn(xCard({ provenance }));
    const article = html.match(/<article[^>]*>/)?.[0] ?? "";
    expect(article).not.toContain("draggable");
    expect(html).toContain("data-column-card-drag-handle");
    expect(html).toContain('draggable="true"');

    const writes: Array<[string, string]> = [];
    const transfer: Pick<DataTransfer, "effectAllowed" | "setData"> = {
      effectAllowed: "none",
      setData: (type: string, value: string) => {
        writes.push([type, value]);
      },
    };
    setColumnCardDragData(transfer, "x-column-card");
    expect(transfer.effectAllowed).toBe("move");
    expect(writes).toEqual([
      [COLUMN_CARD_DRAG_TYPE, "x-column-card"],
      ["text/plain", "x-column-card"],
    ]);
  });
});
