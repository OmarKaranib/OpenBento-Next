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
  configuredStatusLabel,
  watchBotCountSummary,
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

  it("labels domain status as configured, not live worker activity", () => {
    expect(configuredStatusLabel("running")).toBe("configured · running");
    expect(configuredStatusLabel("paused")).toBe("configured · paused");
    expect(WATCHBOT_EXECUTION_CAVEAT.toLowerCase()).toContain("worker");
    expect(WATCHBOT_EXECUTION_CAVEAT.toLowerCase()).toContain("not deployed");
    expect(WATCHBOT_EXECUTION_CAVEAT.toLowerCase()).toContain(
      "x is not activated",
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
