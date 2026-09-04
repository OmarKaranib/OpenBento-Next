import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";

const { box } = vi.hoisted(() => ({ box: { cards: [] as Card[] } }));

vi.mock("@/components/workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({ snapshot: { cards: box.cards, watchBots: [] } }),
}));

vi.mock("@/components/cards/SourceCardChrome", () => ({
  SourceCardChrome: ({ card, children }: { card: Card; children: unknown }) =>
    createElement("section", { "data-card-id": card.id }, children),
}));

import {
  XCardNode,
  safeRenderableXMedia,
  xCardForNode,
} from "./XCardNode";

function xCard(payload: Extract<Card, { type: "x" }>["payload"]): Card {
  return {
    id: "x-card",
    canvasId: "canvas-1",
    position: { x: 0, y: 0 },
    size: { width: 320, height: 260 },
    createdAt: "2026-09-03T12:00:00.000Z",
    updatedAt: "2026-09-03T12:00:00.000Z",
    type: "x",
    payload,
  };
}

const minimalPayload: Extract<Card, { type: "x" }>["payload"] = {
  provenance: {
    sourceUrl: "https://x.com/openbento/status/123",
    title: "Legacy provenance-only post",
    publishedAt: "2026-09-03T11:00:00.000Z",
    sourceType: "x",
    author: "openbento",
    externalId: "123",
    discoveredAt: "2026-09-03T11:01:00.000Z",
  },
};

function renderCard(card: Card): string {
  box.cards = [card];
  return renderToStaticMarkup(
    createElement(XCardNode, {
      data: { cardId: card.id },
      selected: true,
    } as never),
  );
}

describe("XCardNode", () => {
  it("renders a graceful provenance-only fallback for existing Cards", () => {
    const html = renderCard(xCard(minimalPayload));

    expect(html).toContain("Legacy provenance-only post");
    expect(html).toContain("@openbento");
    expect(html).toContain("Open on X");
    expect(html).toContain("https://x.com/openbento/status/123");
    expect(html).not.toContain("data-x-media-count");
  });

  it("renders dense author, media, real metrics, and safe HTML5 video", () => {
    const html = renderCard(
      xCard({
        ...minimalPayload,
        postText: "Iran <script>alert(1)</script> update",
        authorDisplayName: "OpenBento News",
        username: "openbento",
        authorAvatarUrl:
          "https://pbs.twimg.com/profile_images/42/avatar.jpg",
        metrics: { replyCount: 0, repostCount: 2, likeCount: 1_200 },
        media: [
          {
            mediaKey: "7_12",
            type: "video",
            previewImageUrl: "https://pbs.twimg.com/media/poster.jpg",
            playbackUrl: "https://video.twimg.com/media/playback.mp4",
            altText: "Press conference video",
          },
        ],
      }),
    );

    expect(html).toContain("OpenBento News");
    expect(html).toContain("Iran alert(1) update");
    expect(html).not.toContain("<script>");
    expect(html).toContain('data-x-media-count="1"');
    expect(html).toContain("video.twimg.com/media/playback.mp4");
    expect(html).toContain("pbs.twimg.com/media/poster.jpg");
    expect(html).toContain("controls");
    expect(html).toContain('playsInline=""');
    expect(html).toContain('preload="metadata"');
    expect(html).not.toContain("autoplay");
    expect(html).toContain("Replies: 0");
    expect(html).toContain("Likes: 1200");
  });

  it("uses a safe poster when no playable variant is available", () => {
    const html = renderCard(
      xCard({
        ...minimalPayload,
        media: [
          {
            mediaKey: "7_13",
            type: "video",
            previewImageUrl: "https://pbs.twimg.com/media/fallback.jpg",
          },
        ],
      }),
    );

    expect(html).toContain("pbs.twimg.com/media/fallback.jpg");
    expect(html).not.toContain("<video");
    expect(html).toContain("Open on X");
  });

  it("rejects unsafe media at the render boundary", () => {
    expect(
      safeRenderableXMedia([
        {
          mediaKey: "7_14",
          type: "video",
          previewImageUrl: "javascript:alert(1)",
          playbackUrl: "https://evil.example/video.mp4",
        },
      ]),
    ).toEqual([]);
  });

  it("resolves only an X Card and keeps source types distinct", () => {
    const card = xCard(minimalPayload);
    const web = { ...card, id: "web", type: "web" as const } as Card;
    expect(xCardForNode([card, web], "x-card")?.type).toBe("x");
    expect(xCardForNode([card, web], "web")).toBeNull();
  });

  it("contains no provider HTML execution sink", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../../cards/XCardContent.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/dangerouslySetInnerHTML|srcDoc|\beval\s*\(/);
  });
});
