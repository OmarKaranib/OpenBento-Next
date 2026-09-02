import { describe, expect, it } from "vitest";
import type { Card } from "@openbento/domain";
import {
  knownDiscoveredAtLabel,
  provenanceDisplay,
  sanitizedSourceHref,
  sourceKindLabel,
} from "./provenance-display";
import { knownPublishedAtLabel } from "@/lib/domain/source-card";

function sourceCard(args: {
  type: "youtube" | "article" | "web" | "x" | "news";
  sourceType: "youtube" | "web" | "x" | "news";
  sourceUrl: string;
  publishedAt?: string;
  discoveredAt?: string;
  title?: string;
}): Card {
  return {
    id: "card-1",
    canvasId: "canvas-1",
    position: { x: 0, y: 0 },
    size: { width: 280, height: 180 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    type: args.type,
    payload: {
      provenance: {
        sourceUrl: args.sourceUrl,
        title: args.title ?? "Title",
        publishedAt: args.publishedAt ?? "",
        sourceType: args.sourceType,
        ...(args.discoveredAt ? { discoveredAt: args.discoveredAt } : {}),
      },
    },
  } as Card;
}

describe("provenance display helpers", () => {
  it("labels source kind from card.type and provenance.sourceType", () => {
    expect(
      sourceKindLabel(
        sourceCard({
          type: "x",
          sourceType: "x",
          sourceUrl: "https://x.com/status/1",
        }),
      ),
    ).toBe("X");
    expect(
      sourceKindLabel(
        sourceCard({
          type: "youtube",
          sourceType: "youtube",
          sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        }),
      ),
    ).toBe("YouTube");
    expect(
      sourceKindLabel(
        sourceCard({
          type: "article",
          sourceType: "web",
          sourceUrl: "https://example.com/a",
        }),
      ),
    ).toBe("Article");
    expect(
      sourceKindLabel(
        sourceCard({
          type: "web",
          sourceType: "web",
          sourceUrl: "https://example.com/a",
        }),
      ),
    ).toBe("Web");
    expect(
      sourceKindLabel(
        sourceCard({
          type: "news",
          sourceType: "news",
          sourceUrl: "https://news.example.com/a",
        }),
      ),
    ).toBe("News");
    expect(
      sourceKindLabel({
        id: "n1",
        canvasId: "c1",
        position: { x: 0, y: 0 },
        size: { width: 1, height: 1 },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        type: "note",
        payload: { text: "no fake url" },
      }),
    ).toBeNull();
  });

  it("sanitizes hrefs and returns null when missing or unsafe", () => {
    expect(sanitizedSourceHref("https://example.com/story")).toBe(
      "https://example.com/story",
    );
    expect(sanitizedSourceHref("javascript:alert(1)")).toBeNull();
    expect(sanitizedSourceHref("")).toBeNull();
    expect(sanitizedSourceHref(null)).toBeNull();
  });

  it("keeps unknown publishedAt/discoveredAt empty — no clock minting", () => {
    expect(knownPublishedAtLabel("")).toBeNull();
    expect(knownDiscoveredAtLabel("")).toBeNull();
    expect(knownDiscoveredAtLabel("not a date")).toBeNull();
    expect(knownDiscoveredAtLabel("2026-03-14T15:09:00.000Z")).toBe(
      "2026-03-14",
    );

    const missing = provenanceDisplay(
      sourceCard({
        type: "article",
        sourceType: "web",
        sourceUrl: "javascript:alert(1)",
        publishedAt: "",
      }),
    );
    expect(missing).toEqual({
      kind: "Article",
      href: null,
      displayUrl: null,
      publishedAt: null,
      discoveredAt: null,
    });

    const known = provenanceDisplay(
      sourceCard({
        type: "x",
        sourceType: "x",
        sourceUrl: "https://x.com/i/status/1",
        publishedAt: "2026-03-14T15:09:00.000Z",
        discoveredAt: "2026-03-15T01:00:00.000Z",
      }),
    );
    expect(known).toEqual({
      kind: "X",
      href: "https://x.com/i/status/1",
      displayUrl: "https://x.com/i/status/1",
      publishedAt: "2026-03-14",
      discoveredAt: "2026-03-15",
    });
  });
});
