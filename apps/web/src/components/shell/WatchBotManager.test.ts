import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WatchBot } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";

const { box } = vi.hoisted(() => ({
  box: { watchBots: [] as WatchBot[] },
}));

vi.mock("@/components/workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    snapshot: {
      currentCanvasId: "c1",
      watchBots: box.watchBots,
    },
    execute: vi.fn(),
  }),
}));

vi.mock("@/components/workspace/workspace-ui", () => ({
  useWorkspaceUi: () => ({
    setRailPanel: vi.fn(),
  }),
}));

import { WatchBotCanvasPanel } from "./WatchBotManager";
import { WatchBotStatus } from "./WatchBotStatus";

const XSS_ERROR = `<img src=x onerror="alert(1)"><script>alert("xss")</script>`;

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
    expect(html).toContain("Pause");
    expect(html).toContain("Edit");
  });

  it("omits last-activity and error lines when fields are missing or invalid", () => {
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
