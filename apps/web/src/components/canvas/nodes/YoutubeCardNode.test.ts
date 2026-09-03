import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";

const { box } = vi.hoisted(() => ({
  box: { cards: [] as Card[] },
}));

vi.mock("@/components/workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({ snapshot: { cards: box.cards, watchBots: [] } }),
}));

vi.mock("@/components/cards/SourceCardChrome", () => ({
  SourceCardChrome: ({ card, children }: { card: Card; children: unknown }) =>
    createElement(
      "section",
      {
        "data-card-id": card.id,
        "data-watchbot-id":
          (card as Extract<Card, { type: "youtube" }>).payload.provenance
            .watchBotId,
      },
      children,
    ),
}));

vi.mock("@/components/cards/SourceProvenanceMeta", () => ({
  SourceProvenanceMeta: ({ card }: { card: Card }) =>
    createElement("p", {
      "data-provenance": (card as Extract<Card, { type: "youtube" }>).payload
        .provenance.sourceUrl,
    }, "provenance"),
}));

import { YoutubeCardNode } from "./YoutubeCardNode";

const VIDEO_ID = "dQw4w9WgXcQ";

function youtubeCard(videoId = VIDEO_ID): Card {
  return {
    id: "youtube-card",
    canvasId: "canvas-1",
    position: { x: 0, y: 0 },
    size: { width: 280, height: 180 },
    createdAt: "2026-09-03T12:00:00.000Z",
    updatedAt: "2026-09-03T12:00:00.000Z",
    type: "youtube",
    payload: {
      provenance: {
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: "Iran &#39;live&#39; update",
        publishedAt: "2026-09-03T11:00:00.000Z",
        sourceType: "youtube",
        externalId: videoId,
        watchBotId: "iran-live-video",
      },
    },
  } as Card;
}

function renderCard(): string {
  return renderToStaticMarkup(
    createElement(YoutubeCardNode, {
      data: { cardId: "youtube-card" },
      selected: false,
    } as never),
  );
}

describe("YoutubeCardNode inactive player", () => {
  it("renders an official thumbnail, decoded title, and preserved provenance", () => {
    box.cards = [youtubeCard()];

    const html = renderCard();

    expect(html).toContain(
      `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
    );
    expect(html).toContain("Play official embed");
    expect(html).toContain("Iran &#x27;live&#x27; update");
    expect(html).toContain("data-watchbot-id=\"iran-live-video\"");
    expect(html).toContain(
      `data-provenance=\"https://www.youtube.com/watch?v=${VIDEO_ID}\"`,
    );
    expect(html).not.toContain("youtube.com/embed/");
  });

  it("does not construct thumbnail or embed URLs for an invalid video id", () => {
    box.cards = [youtubeCard("invalid")];

    const html = renderCard();

    expect(html).toContain("Invalid YouTube URL");
    expect(html).not.toContain("i.ytimg.com");
    expect(html).not.toContain("youtube.com/embed/");
  });

  it("keeps source text out of HTML execution sinks", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("./YoutubeCardNode.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
