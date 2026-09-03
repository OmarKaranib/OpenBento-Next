import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { InMemoryDomainStore, type ActionName } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";
import { IdSequence } from "../../server/ids";
import { runDomainActionFromRequest } from "../../server/run-action";
import { requestAuthFromVerifiedUser } from "../../server/session";
import { WorkspaceSession } from "./workspace-session";
import {
  STALE_WATCHBOT_UI_PHRASES,
  WATCHBOT_EXECUTION_CAVEAT,
  WATCHBOT_ZERO_STATE_COPY,
  buildCreateWatchBotInput,
  buildPauseWatchBotInput,
  buildResumeWatchBotInput,
  buildUpdateWatchBotInput,
  configuredStatusDotClass,
  configuredStatusLabel,
  dominantConfiguredStatus,
  formatWatchBotLastActivity,
  watchBotCountSummary,
  watchBotErrorDisplay,
  watchBotRunControl,
} from "./watchbot-ui";

const here = dirname(fileURLToPath(import.meta.url));
const shellRoot = join(here, "../../components/shell");

function shellSource(name: string): string {
  return readFileSync(join(shellRoot, name), "utf8");
}

function createUiSession(ownerId = "session-user") {
  const box = {
    store: new InMemoryDomainStore(),
    ids: new IdSequence(),
  };
  const session = new WorkspaceSession({
    seedDefaultCanvas: false,
    runAction: (name, input) =>
      runDomainActionFromRequest(
        requestAuthFromVerifiedUser(ownerId),
        name,
        input,
        { store: box.store, id: box.ids.next },
      ),
    resetStore: () => {
      box.store = new InMemoryDomainStore();
      box.ids.rewind();
    },
  });
  return { session, box };
}

describe("WatchBot UI helpers", () => {
  it("zero-state copy no longer claims a later phase", () => {
    expect(WATCHBOT_ZERO_STATE_COPY).not.toMatch(/later phase/i);
    expect(WATCHBOT_ZERO_STATE_COPY.toLowerCase()).toContain("create one");
  });

  it("buildCreateWatchBotInput matches ACTION_CATALOG required fields", () => {
    expect(
      buildCreateWatchBotInput({
        canvasId: "c1",
        instruction: "Monitor OpenAI and WebMCP",
        name: "Breaking News Watch",
        sourceTypes: ["web", "news"],
      }),
    ).toEqual({
      canvasId: "c1",
      instruction: "Monitor OpenAI and WebMCP",
      name: "Breaking News Watch",
      sourceTypes: ["web", "news"],
    });
  });

  it("buildUpdate/pause/resume inputs use domain action shapes only", () => {
    expect(
      buildUpdateWatchBotInput({
        watchBotId: "wb1",
        name: "Renamed",
        instruction: "Updated instruction",
      }),
    ).toEqual({
      watchBotId: "wb1",
      name: "Renamed",
      instruction: "Updated instruction",
    });
    expect(buildPauseWatchBotInput("wb1")).toEqual({ watchBotId: "wb1" });
    expect(buildResumeWatchBotInput("wb1")).toEqual({ watchBotId: "wb1" });
  });

  it("maps WatchBot status to Pause / Resume / Retry without a new action", () => {
    expect(watchBotRunControl("running")).toEqual({
      action: "pauseWatchBot",
      label: "Pause",
    });
    expect(watchBotRunControl("paused")).toEqual({
      action: "resumeWatchBot",
      label: "Resume",
    });
    expect(watchBotRunControl("error")).toEqual({
      action: "resumeWatchBot",
      label: "Resume / Retry",
    });
  });

  it("labels domain status as configured, not live worker activity", () => {
    expect(configuredStatusLabel("running")).toBe("configured · running");
    expect(configuredStatusLabel("paused")).toBe("configured · paused");
    expect(WATCHBOT_EXECUTION_CAVEAT).toBe(
      "WatchBots monitor configured sources in the background. Activity and source availability depend on the selected sources.",
    );
  });
});

describe("WatchBot UI shell copy", () => {
  it("enables + New WatchBot and drops stale placeholder language", () => {
    const status = shellSource("WatchBotStatus.tsx");
    const manager = shellSource("WatchBotManager.tsx");
    const panels = shellSource("SidePanels.tsx");
    const combined = `${status}\n${manager}\n${panels}`;

    expect(manager).toContain("+ New WatchBot");
    // Header dot is configured-status color (error > running > paused), not live worker.
    expect(status).toContain("configuredStatusDotClass");
    expect(status).toContain("dominantConfiguredStatus");
    expect(status).not.toContain("hasRunning");
    expect(manager).toContain("formatWatchBotLastActivity");
    expect(manager).toContain("watchBotErrorDisplay");
    expect(manager).toContain("monitor configured sources");
    expect(manager).not.toContain("configuration only until the worker runs");
    expect(manager).not.toContain("They do not\n              start live monitoring");
    expect(manager).toContain('role="status"');
    expect(manager).not.toContain("dangerouslySetInnerHTML");
    // Must not be the old permanently-disabled control.
    expect(manager).not.toMatch(
      /type="button"\s+disabled\s+className=[\s\S]{0,160}\+ New WatchBot/,
    );
    expect(manager).toMatch(
      /disabled=\{!canvasId \|\| pending\}[\s\S]{0,80}\+ New WatchBot/,
    );
    for (const phrase of STALE_WATCHBOT_UI_PHRASES) {
      expect(combined).not.toContain(phrase);
    }
    expect(combined).not.toMatch(/Persistent monitors arrive/i);
    expect(panels).not.toContain("Account-wide WatchBots");
    expect(panels).toContain("WatchBotCanvasPanel");
  });

  it("does not introduce a direct Supabase WatchBot write path in the shell", () => {
    const manager = shellSource("WatchBotManager.tsx");
    const status = shellSource("WatchBotStatus.tsx");
    const ui = readFileSync(join(here, "watchbot-ui.ts"), "utf8");
    for (const src of [manager, status, ui]) {
      expect(src).not.toMatch(/from\("@\/server\/supabase/);
      expect(src).not.toMatch(/\.from\(["']watch_bots/);
      expect(src).not.toMatch(/saveWatchBot/);
      expect(src).not.toMatch(/createBrowserSupabaseClient/);
    }
    // Side panel hosts WatchBotCanvasPanel; no new WatchBot table writes.
    const panels = shellSource("SidePanels.tsx");
    expect(panels).not.toMatch(/\.from\(["']watch_bots/);
    expect(panels).not.toMatch(/saveWatchBot/);
    expect(panels).toContain("WatchBotCanvasPanel");
    expect(manager).toContain('execute("createWatchBot"');
    expect(manager).toContain('execute("pauseWatchBot"');
    expect(manager).toContain('execute("resumeWatchBot"');
    expect(manager).toContain('execute("updateWatchBot"');
  });

  it("does not activate a worker or live provider from the WatchBot UI", () => {
    const manager = shellSource("WatchBotManager.tsx");
    const ui = readFileSync(join(here, "watchbot-ui.ts"), "utf8");
    for (const src of [manager, ui]) {
      expect(src).not.toMatch(/runWatchBotPipeline/);
      expect(src).not.toMatch(/X_BEARER_TOKEN/);
      expect(src).not.toMatch(/OPENBENTO_WORKER_ENABLED\s*=\s*true/);
      expect(src).not.toMatch(/xai|grok/i);
    }
  });
});

describe("WatchBot UI → workspace execute", () => {
  it("create/pause/resume/update go through catalog actions and snapshot", async () => {
    const { session } = createUiSession();
    const canvas = await session.execute("createCanvas", { name: "QA" });
    const calls: ActionName[] = [];
    const original = session.execute.bind(session);
    session.execute = (async (name, input, options) => {
      calls.push(name);
      return original(name, input, options);
    }) as typeof session.execute;

    const created = await session.execute(
      "createWatchBot",
      buildCreateWatchBotInput({
        canvasId: canvas.id,
        name: "Breaking News Watch",
        instruction: "Monitor meaningful developments in OpenAI and WebMCP.",
        sourceTypes: ["web", "news"],
      }),
    );
    expect(calls).toContain("createWatchBot");
    expect(created.canvasId).toBe(canvas.id);
    expect(session.getSnapshot().watchBots).toHaveLength(1);
    expect(session.getSnapshot().watchBots[0]?.name).toBe("Breaking News Watch");
    expect(session.getSnapshot().watchBots[0]?.status).toBe("running");
    expect(watchBotCountSummary(session.getSnapshot().watchBots)).toContain(
      "1 WatchBot",
    );
    expect(watchBotCountSummary(session.getSnapshot().watchBots)).toContain(
      "configured running",
    );

    await session.execute(
      "pauseWatchBot",
      buildPauseWatchBotInput(created.id),
    );
    expect(calls).toContain("pauseWatchBot");
    expect(session.getSnapshot().watchBots[0]?.status).toBe("paused");

    await session.execute(
      "resumeWatchBot",
      buildResumeWatchBotInput(created.id),
    );
    expect(calls).toContain("resumeWatchBot");
    expect(session.getSnapshot().watchBots[0]?.status).toBe("running");

    await session.execute(
      "updateWatchBot",
      buildUpdateWatchBotInput({
        watchBotId: created.id,
        name: "Breaking News Watch v2",
        instruction: "Updated monitor instruction",
      }),
    );
    expect(calls).toContain("updateWatchBot");
    expect(session.getSnapshot().watchBots[0]?.name).toBe(
      "Breaking News Watch v2",
    );
    expect(session.getSnapshot().watchBots[0]?.instruction).toBe(
      "Updated monitor instruction",
    );

    expect(
      calls.every((name) => !name.toLowerCase().includes("pipeline")),
    ).toBe(true);
  });

  it("create invokes createWatchBot with current canvasId", async () => {
    const execute = vi.fn(async (name: ActionName, input: unknown) => {
      expect(name).toBe("createWatchBot");
      expect(input).toEqual(
        buildCreateWatchBotInput({
          canvasId: "canvas-current",
          name: "Breaking News Watch",
          instruction: "Monitor meaningful developments in OpenAI and WebMCP.",
          sourceTypes: ["web", "news"],
        }),
      );
      return {
        id: "wb-1",
        ownerId: "qa-owner",
        canvasId: "canvas-current",
        name: "Breaking News Watch",
        instruction: "Monitor meaningful developments in OpenAI and WebMCP.",
        status: "running" as const,
        sourceTypes: ["web", "news"] as const,
        createdAt: "2026-08-30T12:00:00.000Z",
        updatedAt: "2026-08-30T12:00:00.000Z",
      };
    });

    await execute(
      "createWatchBot",
      buildCreateWatchBotInput({
        canvasId: "canvas-current",
        name: "Breaking News Watch",
        instruction: "Monitor meaningful developments in OpenAI and WebMCP.",
        sourceTypes: ["web", "news"],
      }),
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("WatchBot last-activity and error display", () => {
  it("formats parseable lastActivityAt as a short UTC label and rejects invalid", () => {
    expect(formatWatchBotLastActivity(undefined)).toBeNull();
    expect(formatWatchBotLastActivity("")).toBeNull();
    expect(formatWatchBotLastActivity("   ")).toBeNull();
    expect(formatWatchBotLastActivity("not-a-date")).toBeNull();
    expect(formatWatchBotLastActivity("2026")).toBeNull();
    expect(formatWatchBotLastActivity("2026-02-31")).toBeNull();
    expect(formatWatchBotLastActivity("2026-13-01")).toBeNull();
    expect(formatWatchBotLastActivity("now")).toBeNull();
    expect(formatWatchBotLastActivity("2026-08-30")).toBe("2026-08-30");
    expect(formatWatchBotLastActivity("2026-08-30T14:22:09.000Z")).toBe(
      "2026-08-30 14:22",
    );
    expect(formatWatchBotLastActivity("  2026-09-01T00:05:00.000Z  ")).toBe(
      "2026-09-01 00:05",
    );
    expect(formatWatchBotLastActivity("2026-08-30T23:59:00.000Z")).toBe(
      "2026-08-30 23:59",
    );
    expect(formatWatchBotLastActivity("2026-08-30T14:22:09.000Z")).not.toMatch(
      /now/i,
    );
  });

  it("does not invent a current timestamp for missing lastActivityAt", () => {
    const ui = readFileSync(join(here, "watchbot-ui.ts"), "utf8");
    expect(ui).not.toMatch(/new Date\(\s*\)/);
    expect(ui).not.toMatch(/Date\.now\(/);
    expect(formatWatchBotLastActivity()).toBeNull();
  });

  it("sanitizes lastError as untrusted plain text", () => {
    expect(watchBotErrorDisplay(undefined)).toBeNull();
    expect(watchBotErrorDisplay("")).toBeNull();
    expect(watchBotErrorDisplay("   ")).toBeNull();
    expect(watchBotErrorDisplay("provider_unavailable")).toBe(
      "provider_unavailable",
    );
    expect(
      watchBotErrorDisplay(
        `<img src=x onerror="alert(1)"><script>alert("xss")</script>`,
      ),
    ).toBe('alert("xss")');
    expect(
      watchBotErrorDisplay(
        `<img src=x onerror="alert(1)"><script>alert("xss")</script>`,
      ),
    ).not.toContain("<script");
    expect(
      watchBotErrorDisplay(
        `<img src=x onerror="alert(1)"><script>alert("xss")</script>`,
      ),
    ).not.toContain("<img");
    expect(watchBotErrorDisplay("<script></script>")).toBeNull();
  });

  it("picks dominant configured status error > running > paused", () => {
    expect(dominantConfiguredStatus([])).toBeNull();
    expect(dominantConfiguredStatus([{ status: "paused" }])).toBe("paused");
    expect(
      dominantConfiguredStatus([{ status: "paused" }, { status: "running" }]),
    ).toBe("running");
    expect(
      dominantConfiguredStatus([
        { status: "running" },
        { status: "error" },
        { status: "paused" },
      ]),
    ).toBe("error");
    expect(configuredStatusDotClass(null)).toBe("bg-zinc-600");
    expect(configuredStatusDotClass("running")).toBe("bg-emerald-500");
    expect(configuredStatusDotClass("paused")).toBe("bg-amber-500");
    expect(configuredStatusDotClass("error")).toBe("bg-red-500");
  });

  it("includes error count in the header summary when present", () => {
    expect(
      watchBotCountSummary([{ status: "error" }, { status: "running" }]),
    ).toBe("2 WatchBots · 1 configured running · 1 error");
    expect(watchBotCountSummary([{ status: "error" }])).toBe(
      "1 WatchBot · 1 error",
    );
  });
});
