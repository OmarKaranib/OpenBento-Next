import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Card, WatchBot } from "@openbento/domain";
import { SourceProvenanceMeta } from "@/components/cards/SourceProvenanceMeta";
import { WatchBotAttribution } from "@/components/cards/WatchBotAttribution";
import {
  WATCHBOT_LABEL_FALLBACK,
  cardWatchBotId,
  countCardsForWatchBot,
  latestWatchBotCardTitle,
  resolveWatchBotLabel,
  watchBotAttributionLabel,
  watchBotCanvasActivity,
  watchBotCardCountLabel,
} from "./watchbot-attribution";

const XSS_NAME = `<img src=x onerror="alert(1)"><script>alert("xss")</script>`;

function sourceCard(args: {
  id?: string;
  canvasId?: string;
  createdAt?: string;
  type?: "youtube" | "article" | "web" | "x";
  watchBotId?: string;
  title?: string;
}): Card {
  const type = args.type ?? "article";
  return {
    id: args.id ?? "card-1",
    canvasId: args.canvasId ?? "canvas-1",
    position: { x: 0, y: 0 },
    size: { width: 280, height: 180 },
    createdAt: args.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: args.createdAt ?? "2026-01-01T00:00:00.000Z",
    type,
    payload: {
      provenance: {
        sourceUrl: "https://example.com/a",
        title: args.title ?? "Title",
        publishedAt: "",
        sourceType: type === "youtube" ? "youtube" : type === "x" ? "x" : "web",
        ...(args.watchBotId ? { watchBotId: args.watchBotId } : {}),
      },
    },
  } as Card;
}

function noteCard(canvasId = "canvas-1"): Card {
  return {
    id: "note-1",
    canvasId,
    position: { x: 0, y: 0 },
    size: { width: 200, height: 120 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    type: "note",
    payload: { text: "no fake url" },
  };
}

function bot(partial: Partial<WatchBot> & Pick<WatchBot, "id">): WatchBot {
  return {
    ownerId: "owner-1",
    canvasId: "canvas-1",
    instruction: "Watch the story",
    status: "running",
    sourceTypes: ["web"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("resolveWatchBotLabel", () => {
  it("uses sanitized snapshot name, then WatchBot, then truncated id", () => {
    expect(
      resolveWatchBotLabel("wb-named", [bot({ id: "wb-named", name: "News Desk" })]),
    ).toBe("News Desk");
    expect(
      resolveWatchBotLabel("wb-blank", [bot({ id: "wb-blank", name: "   " })]),
    ).toBe(WATCHBOT_LABEL_FALLBACK);
    expect(
      resolveWatchBotLabel("wb-unnamed", [bot({ id: "wb-unnamed" })]),
    ).toBe(WATCHBOT_LABEL_FALLBACK);
    expect(resolveWatchBotLabel("watchbot-missing-id", [])).toBe("watchbot");
    expect(resolveWatchBotLabel("ab", [])).toBe("ab");
    expect(resolveWatchBotLabel("", [])).toBeNull();
    expect(resolveWatchBotLabel(undefined, [])).toBeNull();
    expect(
      resolveWatchBotLabel("wb-xss", [bot({ id: "wb-xss", name: XSS_NAME })]),
    ).toBe('alert("xss")');
    expect(
      resolveWatchBotLabel("wb-xss", [bot({ id: "wb-xss", name: XSS_NAME })]),
    ).not.toContain("<script");
  });
});

describe("countCardsForWatchBot / latest title", () => {
  const cards: Card[] = [
    sourceCard({
      id: "c-old",
      watchBotId: "wb-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      title: "Older story",
    }),
    sourceCard({
      id: "c-new",
      watchBotId: "wb-1",
      createdAt: "2026-01-03T00:00:00.000Z",
      title: "Newest story",
    }),
    sourceCard({
      id: "c-other-bot",
      watchBotId: "wb-2",
      createdAt: "2026-01-04T00:00:00.000Z",
      title: "Other bot card",
    }),
    sourceCard({
      id: "c-other-canvas",
      canvasId: "canvas-2",
      watchBotId: "wb-1",
      createdAt: "2026-01-05T00:00:00.000Z",
      title: "Other canvas",
    }),
    sourceCard({
      id: "c-manual",
      createdAt: "2026-01-06T00:00:00.000Z",
      title: "Manual add",
    }),
    noteCard(),
  ];

  it("counts only current-Canvas Cards with matching provenance.watchBotId", () => {
    expect(countCardsForWatchBot(cards, "wb-1", "canvas-1")).toBe(2);
    expect(countCardsForWatchBot(cards, "wb-2", "canvas-1")).toBe(1);
    expect(countCardsForWatchBot(cards, "wb-missing", "canvas-1")).toBe(0);
    expect(countCardsForWatchBot(cards, "", "canvas-1")).toBe(0);
    expect(countCardsForWatchBot([], "wb-1", "canvas-1")).toBe(0);
    expect(watchBotCardCountLabel(0)).toBe("0 cards on this Canvas");
    expect(watchBotCardCountLabel(1)).toBe("1 card on this Canvas");
    expect(watchBotCardCountLabel(2)).toBe("2 cards on this Canvas");
  });

  it("selects the newest matching title and omits when none", () => {
    expect(latestWatchBotCardTitle(cards, "wb-1", "canvas-1")).toBe(
      "Newest story",
    );
    expect(latestWatchBotCardTitle(cards, "wb-2", "canvas-1")).toBe(
      "Other bot card",
    );
    expect(latestWatchBotCardTitle(cards, "wb-missing", "canvas-1")).toBeNull();
    expect(
      latestWatchBotCardTitle(
        [
          sourceCard({
            watchBotId: "wb-empty",
            title: "   ",
          }),
        ],
        "wb-empty",
        "canvas-1",
      ),
    ).toBeNull();
    expect(
      latestWatchBotCardTitle(
        [
          sourceCard({
            watchBotId: "wb-xss",
            title: XSS_NAME,
          }),
        ],
        "wb-xss",
        "canvas-1",
      ),
    ).toBe('alert("xss")');
  });

  it("packages count + latest title for the WatchBot panel", () => {
    expect(watchBotCanvasActivity(cards, "wb-1", "canvas-1")).toEqual({
      cardCount: 2,
      countLabel: "2 cards on this Canvas",
      latestTitle: "Newest story",
    });
    expect(watchBotCanvasActivity(cards, "none", "canvas-1")).toEqual({
      cardCount: 0,
      countLabel: "0 cards on this Canvas",
      latestTitle: null,
    });
  });
});

describe("provenance attribution display", () => {
  it("exposes watchBotId only when present on sourced Cards", () => {
    const withBot = sourceCard({ watchBotId: "wb-1", type: "youtube" });
    const without = sourceCard({ type: "web" });
    expect(cardWatchBotId(withBot)).toBe("wb-1");
    expect(cardWatchBotId(without)).toBeNull();
    expect(cardWatchBotId(noteCard())).toBeNull();
    expect(
      watchBotAttributionLabel(withBot, [bot({ id: "wb-1", name: "Desk" })]),
    ).toBe("Desk");
    expect(watchBotAttributionLabel(without, [bot({ id: "wb-1", name: "Desk" })])).toBeNull();
  });

  it("renders Added by when watchBotId is present and omits it when absent", () => {
    const watchBots = [bot({ id: "wb-1", name: "Breaking News" })];
    const present = renderToStaticMarkup(
      createElement(WatchBotAttribution, {
        watchBotId: "wb-1",
        watchBots,
      }),
    );
    expect(present).toContain("Added by");
    expect(present).toContain("Breaking News");
    expect(present).not.toContain("<script");

    const absent = renderToStaticMarkup(
      createElement(WatchBotAttribution, {
        watchBotId: undefined,
        watchBots,
      }),
    );
    expect(absent).toBe("");

    const metaPresent = renderToStaticMarkup(
      createElement(SourceProvenanceMeta, {
        card: sourceCard({
          watchBotId: "wb-1",
          type: "x",
        }),
        watchBots,
      }),
    );
    expect(metaPresent).toContain("Added by");
    expect(metaPresent).toContain("Breaking News");

    const metaAbsent = renderToStaticMarkup(
      createElement(SourceProvenanceMeta, {
        card: sourceCard({ type: "article" }),
        watchBots,
      }),
    );
    expect(metaAbsent).not.toContain("Added by");
  });

  it("sanitizes WatchBot names in attribution markup", () => {
    const html = renderToStaticMarkup(
      createElement(WatchBotAttribution, {
        watchBotId: "wb-xss",
        watchBots: [bot({ id: "wb-xss", name: XSS_NAME })],
      }),
    );
    expect(html).toContain("Added by");
    expect(html).toContain("alert(&quot;xss&quot;)");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });
});
