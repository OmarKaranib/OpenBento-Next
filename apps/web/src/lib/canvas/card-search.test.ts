import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Card } from "@openbento/domain";
import {
  cardMatchesMonitorFilter,
  cardSearchText,
  emptyMonitorFilter,
  monitorFilterIsActive,
} from "./card-search";

const here = dirname(fileURLToPath(import.meta.url));

function note(args: {
  id: string;
  text: string;
  position?: Card["position"];
}): Extract<Card, { type: "note" }> {
  return {
    id: args.id,
    canvasId: "canvas-1",
    position: args.position ?? { x: 10, y: 20 },
    size: { width: 240, height: 160 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    type: "note",
    payload: { text: args.text },
  };
}

function source(args: {
  id: string;
  type: "youtube" | "article" | "web" | "x";
  title: string;
  sourceType?: "youtube" | "web" | "x" | "news";
  position?: Card["position"];
}): Card {
  const sourceType =
    args.sourceType ??
    (args.type === "article" || args.type === "web" ? "web" : args.type);
  return {
    id: args.id,
    canvasId: "canvas-1",
    position: args.position ?? { x: 40, y: 80 },
    size: { width: 280, height: 180 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    type: args.type,
    payload: {
      provenance: {
        sourceUrl: "https://example.com/story",
        title: args.title,
        publishedAt: "",
        sourceType,
      },
    },
  } as Card;
}

describe("current-Canvas search/filter matching", () => {
  it("matches Note text and source provenance titles, case-insensitive", () => {
    const briefing = note({ id: "n1", text: "Lake Ontario briefing" });
    const video = source({
      id: "y1",
      type: "youtube",
      title: "Press conference",
    });
    const article = source({
      id: "a1",
      type: "article",
      title: "Official statement",
    });

    expect(cardSearchText(briefing)).toBe("Lake Ontario briefing");
    expect(cardSearchText(video)).toBe("Press conference");

    const query = { ...emptyMonitorFilter(), query: "ontario" };
    const none = new Set<string>();
    expect(cardMatchesMonitorFilter(briefing, query, none)).toBe(true);
    expect(cardMatchesMonitorFilter(video, query, none)).toBe(false);
    expect(
      cardMatchesMonitorFilter(
        article,
        { ...emptyMonitorFilter(), query: "OFFICIAL" },
        none,
      ),
    ).toBe(true);
  });

  it("filters by Card type and optional sourceType", () => {
    const n = note({ id: "n1", text: "hello" });
    const yt = source({ id: "y1", type: "youtube", title: "hello" });
    const x = source({ id: "x1", type: "x", title: "hello" });
    const articleNews = source({
      id: "a1",
      type: "article",
      title: "hello",
      sourceType: "news",
    });
    const none = new Set<string>();

    expect(
      cardMatchesMonitorFilter(
        n,
        { ...emptyMonitorFilter(), types: ["note"] },
        none,
      ),
    ).toBe(true);
    expect(
      cardMatchesMonitorFilter(
        yt,
        { ...emptyMonitorFilter(), types: ["note"] },
        none,
      ),
    ).toBe(false);
    expect(
      cardMatchesMonitorFilter(
        x,
        { ...emptyMonitorFilter(), types: ["x"] },
        none,
      ),
    ).toBe(true);
    expect(
      cardMatchesMonitorFilter(
        articleNews,
        { ...emptyMonitorFilter(), sourceTypes: ["news"] },
        none,
      ),
    ).toBe(true);
    expect(
      cardMatchesMonitorFilter(
        n,
        { ...emptyMonitorFilter(), sourceTypes: ["news"] },
        none,
      ),
    ).toBe(false);
  });

  it("New-only keeps Cards in the provided id set", () => {
    const n = note({ id: "n1", text: "hello" });
    const yt = source({ id: "y1", type: "youtube", title: "hello" });
    expect(
      cardMatchesMonitorFilter(
        n,
        { ...emptyMonitorFilter(), newOnly: true },
        new Set(["n1"]),
      ),
    ).toBe(true);
    expect(
      cardMatchesMonitorFilter(
        yt,
        { ...emptyMonitorFilter(), newOnly: true },
        new Set(["n1"]),
      ),
    ).toBe(false);
  });

  it("empty query and cleared filters match every Card", () => {
    const filter = emptyMonitorFilter();
    expect(monitorFilterIsActive(filter)).toBe(false);
    expect(
      cardMatchesMonitorFilter(
        note({ id: "n1", text: "" }),
        filter,
        new Set(),
      ),
    ).toBe(true);
    expect(
      monitorFilterIsActive({ ...filter, query: "  x  " }),
    ).toBe(true);
  });

  it("does not mention domain mutation actions", () => {
    const source = readFileSync(join(here, "card-search.ts"), "utf8");
    expect(source).not.toMatch(/moveCard|resizeCard|updateCard|setCardFrame/);
    expect(source).not.toMatch(/execute\(/);
  });

  it("matches sanitized plain text, not raw HTML tags", () => {
    const tagged = source({
      id: "html",
      type: "article",
      title: '<script>alert(1)</script>Official',
    });
    expect(cardSearchText(tagged)).not.toContain("<script");
    expect(
      cardMatchesMonitorFilter(
        tagged,
        { ...emptyMonitorFilter(), query: "official" },
        new Set(),
      ),
    ).toBe(true);
    expect(
      cardMatchesMonitorFilter(
        tagged,
        { ...emptyMonitorFilter(), query: "<script" },
        new Set(),
      ),
    ).toBe(false);
  });
});
