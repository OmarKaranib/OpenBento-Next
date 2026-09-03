import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Card } from "@openbento/domain";
import { describe, expect, it } from "vitest";
import {
  NewsCardNode,
  sourceLinkCardForNode,
} from "@/components/canvas/nodes/ArticleCardNode";
import {
  cardNodeTypes,
  getCardType,
  listCreatableCardTypes,
} from "./registry";
import { provenanceDisplay } from "@/lib/canvas/provenance-display";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../..");

const persistedNewsCard: Extract<Card, { type: "news" }> = {
  id: "news-card-1",
  canvasId: "canvas-1",
  position: { x: 80, y: 120 },
  size: { width: 320, height: 220 },
  createdAt: "2026-09-03T14:00:00.000Z",
  updatedAt: "2026-09-03T14:00:00.000Z",
  type: "news",
  payload: {
    provenance: {
      sourceUrl: "https://news.example.com/iran-nuclear-talks",
      title: "Iran nuclear talks resume",
      publishedAt: "2026-09-03T12:00:00.000Z",
      discoveredAt: "2026-09-03T14:00:00.000Z",
      sourceType: "news",
      watchBotId: "watchbot-1",
    },
  },
};

describe("News Card registry", () => {
  it("registers News as a non-creatable source Card with the source renderer", () => {
    expect(getCardType("news")).toMatchObject({
      type: "news",
      label: "News",
      creatable: false,
      createMode: "source",
    });
    expect(getCardType("news")?.Node).toBe(NewsCardNode);
    expect(cardNodeTypes().news).toBe(NewsCardNode);
    expect(getCardType("news")?.defaultSize).toEqual(
      getCardType("article")?.defaultSize,
    );
    expect(getCardType("news")?.defaultSize).toEqual(
      getCardType("web")?.defaultSize,
    );
    expect(getCardType("news")?.defaultSize).toEqual(
      getCardType("x")?.defaultSize,
    );
    expect(listCreatableCardTypes().map((entry) => entry.type)).not.toContain(
      "news",
    );
  });

  it("resolves a persisted News Card and preserves its source provenance", () => {
    expect(
      sourceLinkCardForNode([persistedNewsCard], "news-card-1", "news"),
    ).toBe(persistedNewsCard);
    expect(
      sourceLinkCardForNode([persistedNewsCard], "news-card-1", "web"),
    ).toBeNull();
    expect(provenanceDisplay(persistedNewsCard)).toEqual({
      kind: "News",
      href: "https://news.example.com/iran-nuclear-talks",
      displayUrl: "https://news.example.com/iran-nuclear-talks",
      publishedAt: "2026-09-03",
      discoveredAt: "2026-09-03",
    });
  });

  it("keeps the existing Card renderers registered", () => {
    expect(["note", "youtube", "article", "web", "x"].map(getCardType)).not.toContain(
      undefined,
    );
    const source = readFileSync(
      join(webSrc, "components/canvas/nodes/ArticleCardNode.tsx"),
      "utf8",
    );
    expect(source).toContain("<SourceProvenanceMeta card={card} author={author} />");
  });
});
