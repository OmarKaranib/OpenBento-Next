import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card, WatchBot } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";

const { box } = vi.hoisted(() => ({
  box: { watchBots: [] as WatchBot[], cards: [] as Card[] },
}));

vi.mock("@/components/workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    snapshot: {
      currentCanvasId: "c1",
      watchBots: box.watchBots,
      cards: box.cards,
    },
    execute: vi.fn(),
  }),
}));

vi.mock("@/components/workspace/workspace-ui", () => ({
  useWorkspaceUi: () => ({
    setRailPanel: vi.fn(),
    watchBotCreateEpoch: 0,
    openWatchBotCreate: vi.fn(),
  }),
}));

import { WatchBotCanvasPanel } from "./WatchBotManager";
import { WatchBotStatus } from "./WatchBotStatus";

const XSS_ERROR = `<img src=x onerror="alert(1)"><script>alert("xss")</script>`;
const XSS_TITLE = `<img src=x onerror="alert(1)"><script>alert("xss")</script>`;

function fixture(partial: Partial<WatchBot> & Pick<WatchBot, "id">): WatchBot {
  return {
    ownerId: "owner-1",
    canvasId: "c1",
    name: "Breaking News Watch",
    instruction: "Monitor OpenAI and WebMCP",
    status: "running",
    sourceTypes: ["web", "news"],
    createdAt: "2026-08-30T12:00:00.000Z",
    updatedAt: "2026-08-30T12:00:00.000Z",
    ...partial,
  };
}

describe("WatchBot list last-activity and error markup", () => {
  it("renders formatted lastActivityAt and sanitized lastError as text", () => {
    box.cards = [];
    box.watchBots = [
      fixture({
        id: "wb-error",
        status: "error",
        lastActivityAt: "2026-08-30T14:22:09.000Z",
        lastError: XSS_ERROR,
      }),
    ];
    const html = renderToStaticMarkup(createElement(WatchBotCanvasPanel));
    expect(html).toContain("Last activity 2026-08-30 14:22");
    expect(html).toContain('alert(&quot;xss&quot;)');
    expect(html).toContain('role="status"');
    expect(html).toContain("text-red-400");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).toContain("Resume / Retry");
    expect(html).not.toContain(">Pause<");
    expect(html).toContain("Edit");
  });

  it("renders Resume on paused WatchBots and Pause on running WatchBots", () => {
    box.cards = [];
    box.watchBots = [fixture({ id: "wb-paused", status: "paused" })];
    const paused = renderToStaticMarkup(createElement(WatchBotCanvasPanel));
    expect(paused).toContain("Resume");
    expect(paused).not.toContain("Resume / Retry");
    expect(paused).not.toContain(">Pause<");

    box.watchBots = [fixture({ id: "wb-running", status: "running" })];
    const running = renderToStaticMarkup(createElement(WatchBotCanvasPanel));
    expect(running).toContain("Pause");
    expect(running).not.toContain("Resume");
  });

  it("omits last-activity and error lines when fields are missing or invalid", () => {
    box.cards = [];
    box.watchBots = [
      fixture({
        id: "wb-running",
        status: "running",
        lastActivityAt: "not-a-date",
        lastError: "   ",
      }),
    ];
    const html = renderToStaticMarkup(createElement(WatchBotCanvasPanel));
    expect(html).not.toContain("Last activity");
    expect(html).not.toContain('role="status"');
    expect(html).toContain("configured · running");
    expect(html).toContain("0 cards on this Canvas");
    expect(html).not.toContain("Latest:");
    expect(html).toContain("Pause");
    expect(html).not.toContain("Resume / Retry");
  });

  it("shows snapshot Card count and sanitized latest title for this WatchBot", () => {
    box.watchBots = [fixture({ id: "wb-1" })];
    box.cards = [
      {
        id: "card-old",
        canvasId: "c1",
        position: { x: 0, y: 0 },
        size: { width: 280, height: 180 },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        type: "article",
        payload: {
          provenance: {
            sourceUrl: "https://example.com/old",
            title: "Older",
            publishedAt: "",
            sourceType: "web",
            watchBotId: "wb-1",
          },
        },
      },
      {
        id: "card-new",
        canvasId: "c1",
        position: { x: 0, y: 0 },
        size: { width: 280, height: 180 },
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        type: "web",
        payload: {
          provenance: {
            sourceUrl: "https://example.com/new",
            title: XSS_TITLE,
            publishedAt: "",
            sourceType: "web",
            watchBotId: "wb-1",
          },
        },
      },
    ] as Card[];
    const html = renderToStaticMarkup(createElement(WatchBotCanvasPanel));
    expect(html).toContain("2 cards on this Canvas");
    expect(html).toContain("Latest:");
    expect(html).toContain("alert(&quot;xss&quot;)");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });
});

describe("WatchBot header configured-status dot", () => {
  it("uses zinc when empty, emerald when running, red when any error", () => {
    box.watchBots = [];
    expect(renderToStaticMarkup(createElement(WatchBotStatus))).toContain(
      "bg-zinc-600",
    );

    box.watchBots = [fixture({ id: "wb-run", status: "running" })];
    expect(renderToStaticMarkup(createElement(WatchBotStatus))).toContain(
      "bg-emerald-500",
    );

    box.watchBots = [
      fixture({ id: "wb-run", status: "running" }),
      fixture({ id: "wb-err", status: "error" }),
    ];
    const errorHtml = renderToStaticMarkup(createElement(WatchBotStatus));
    expect(errorHtml).toContain("bg-red-500");
    expect(errorHtml).toContain("1 error");
    expect(errorHtml).not.toContain("bg-emerald-500");
  });
});
