import { describe, expect, it } from "vitest";
import {
  createActionExecutor,
  InMemoryDomainStore,
} from "@openbento/domain";
import { FakeSourceProvider } from "@openbento/watchbot";
import { runWorkerCycle } from "./cycle";
import { seedFixtureStore } from "./fixture";

describe("WatchBot worker cycle", () => {
  it("skips discovery when the WatchBot is paused", async () => {
    const { store, ownerId, watchBotId, provider } = await seedFixtureStore();
    const executor = createActionExecutor({ store, ownerId });
    await executor.pauseWatchBot({ watchBotId });
    expect(provider.discoverCalls).toBe(0);

    const result = await runWorkerCycle({ store, provider });
    expect(result.skippedPaused).toBe(1);
    expect(result.processed).toBe(0);
    expect(provider.discoverCalls).toBe(0);
    const status = await executor.getWatchBotStatus({ watchBotId });
    expect(status.status).toBe("paused");
    const state = await executor.getCanvasState({
      canvasId: (await executor.getWatchBotStatus({ watchBotId })).canvasId,
    });
    expect(state.cards).toHaveLength(0);
  });

  it("resumes and continues discovery", async () => {
    const { store, ownerId, watchBotId, provider } = await seedFixtureStore();
    const executor = createActionExecutor({ store, ownerId });
    await executor.pauseWatchBot({ watchBotId });
    await runWorkerCycle({ store, provider });
    expect(provider.discoverCalls).toBe(0);

    await executor.resumeWatchBot({ watchBotId });
    const result = await runWorkerCycle({ store, provider });
    expect(result.processed).toBe(1);
    expect(result.cardsCreated).toBeGreaterThan(0);
    expect(provider.discoverCalls).toBe(1);
    const status = await executor.getWatchBotStatus({ watchBotId });
    expect(status.status).toBe("running");
  });

  it("sets status error + lastError without crashing the process", async () => {
    const store = new InMemoryDomainStore();
    const a = createActionExecutor({ store, ownerId: "user-a" });
    const b = createActionExecutor({ store, ownerId: "user-b" });
    const canvasA = await a.createCanvas({ name: "A" });
    const canvasB = await b.createCanvas({ name: "B" });
    const botA = await a.createWatchBot({
      canvasId: canvasA.id,
      instruction: "Monitor Lake Ontario rename developments",
    });
    const botB = await b.createWatchBot({
      canvasId: canvasB.id,
      instruction: "Monitor Lake Ontario rename developments",
    });

    const provider = new FakeSourceProvider([
      {
        sourceUrl: "https://news.example.com/ontario",
        title: "Lake Ontario rename update",
        publishedAt: "2026-08-28T12:00:00.000Z",
        sourceType: "news",
        rawExcerpt: "Officials discussed the Lake Ontario proposal.",
      },
    ]);
    const original = provider.discover.bind(provider);
    let calls = 0;
    provider.discover = async (input) => {
      calls += 1;
      if (input.watchBotId === botA.id) {
        throw new Error("provider_unavailable");
      }
      return original(input);
    };

    const result = await runWorkerCycle({ store, provider });
    expect(result.errors).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.cardsCreated).toBeGreaterThan(0);
    expect(calls).toBe(2);

    const statusA = await a.getWatchBotStatus({ watchBotId: botA.id });
    expect(statusA.status).toBe("error");
    expect(statusA.lastError).toMatch(/provider_unavailable/);

    const statusB = await b.getWatchBotStatus({ watchBotId: botB.id });
    expect(statusB.status).toBe("running");
  });

  it("does not invent a second store — Cards exist on the shared DomainStore", async () => {
    const { store, ownerId, provider } = await seedFixtureStore();
    await runWorkerCycle({ store, provider });
    const executor = createActionExecutor({ store, ownerId });
    const bots = await store.listWatchBots();
    const bot = bots[0];
    expect(bot).toBeDefined();
    if (!bot) {
      throw new Error("expected fixture bot");
    }
    const state = await executor.getCanvasState({ canvasId: bot.canvasId });
    expect(state.cards.length).toBeGreaterThan(0);
    expect(
      state.cards.every((card) => card.type === "web" || card.type === "news"),
    ).toBe(true);
  });
});
