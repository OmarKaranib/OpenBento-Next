import { describe, expect, it, vi } from "vitest";
import {
  createActionExecutor,
  InMemoryDomainStore,
  type WatchBotSourceType,
} from "@openbento/domain";
import {
  createModelMeaningfulnessClassifier,
  createOpenAIMeaningfulnessClassifier,
  createXSourceProvider,
  FakeSourceProvider,
} from "@openbento/watchbot";
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

  it("does not invoke X discover for web/news-only WatchBots", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "x-skip-user" });
    const canvas = await executor.createCanvas({ name: "Mixed" });
    await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor web coverage",
      sourceTypes: ["web", "news"],
    });

    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const provider = createXSourceProvider({
      enabled: true,
      bearerToken: "test-bearer-token",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await runWorkerCycle({
      store,
      provider,
      env: { X_MAX_REQUESTS_PER_WORKER_TICK: "1" },
    });

    expect(result.providerEligibleWatchBots).toBe(0);
    expect(result.xHttpRequests).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.cycles[0]?.skipReason).toBe("provider_not_eligible");
  });

  it("shares the global X HTTP budget across eligible WatchBots", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "x-budget-user" });
    const canvas = await executor.createCanvas({ name: "X lane" });
    await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor Lake Ontario developments",
      sourceTypes: ["x"],
      name: "X bot A",
    });
    await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor Lake Ontario developments",
      sourceTypes: ["x"],
      name: "X bot B",
    });

    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "9001",
              text: "Lake Ontario developments",
              author_id: "42",
              created_at: "2026-08-29T12:00:00.000Z",
            },
          ],
          includes: { users: [{ id: "42", username: "openbento" }] },
          meta: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const provider = createXSourceProvider({
      enabled: true,
      bearerToken: "test-bearer-token",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await runWorkerCycle({
      store,
      provider,
      env: { X_MAX_REQUESTS_PER_WORKER_TICK: "1" },
    });

    expect(result.providerEligibleWatchBots).toBe(2);
    expect(result.xHttpRequests).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.cycles[0]?.skipped).toBe(false);
    expect(result.cycles[1]?.skipReason).toBe("x_budget_exhausted");
    expect(result.errors).toBe(0);
  });

  it("non-X fake provider consumes zero X budget counters", async () => {
    const { store, provider } = await seedFixtureStore();
    const result = await runWorkerCycle({
      store,
      provider,
      env: { X_MAX_REQUESTS_PER_WORKER_TICK: "1" },
    });
    expect(result.xHttpRequests).toBe(0);
    expect(result.processed).toBe(1);
  });

  it("does not stamp lastActivityAt for provider_not_eligible skips", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "activity-skip-user" });
    const canvas = await executor.createCanvas({ name: "Web only" });
    const watchBot = await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor web coverage",
      sourceTypes: ["web", "news"],
    });
    const stampedAt = "2026-08-28T10:00:00.000Z";
    await store.saveWatchBot({
      ...(await store.getWatchBot(watchBot.id))!,
      lastActivityAt: stampedAt,
    });

    const provider = createXSourceProvider({
      enabled: true,
      bearerToken: "test-bearer-token",
      fetchImpl: vi.fn(async () => new Response("{}", { status: 200 })) as typeof fetch,
    });

    await runWorkerCycle({ store, provider });

    const after = await store.getWatchBot(watchBot.id);
    expect(after?.lastActivityAt).toBe(stampedAt);
  });

  it("does not stamp lastActivityAt for x_budget_exhausted skips", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "budget-skip-user" });
    const canvas = await executor.createCanvas({ name: "X lane" });
    const first = await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor Lake Ontario developments",
      sourceTypes: ["x"],
      name: "X bot A",
    });
    const second = await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor Lake Ontario developments",
      sourceTypes: ["x"],
      name: "X bot B",
    });
    const stampedAt = "2026-08-28T10:00:00.000Z";
    await store.saveWatchBot({
      ...(await store.getWatchBot(second.id))!,
      lastActivityAt: stampedAt,
    });

    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "9001",
              text: "Lake Ontario developments",
              author_id: "42",
              created_at: "2026-08-29T12:00:00.000Z",
            },
          ],
          includes: { users: [{ id: "42", username: "openbento" }] },
          meta: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const provider = createXSourceProvider({
      enabled: true,
      bearerToken: "test-bearer-token",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await runWorkerCycle({
      store,
      provider,
      env: { X_MAX_REQUESTS_PER_WORKER_TICK: "1" },
    });

    expect(await store.getWatchBot(first.id)).toMatchObject({
      lastActivityAt: expect.any(String),
    });
    const afterSecond = await store.getWatchBot(second.id);
    expect(afterSecond?.lastActivityAt).toBe(stampedAt);
  });

  it("counts only running WatchBots as provider-eligible", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "eligible-count-user" });
    const canvas = await executor.createCanvas({ name: "Mixed statuses" });
    const runningX = await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor Lake Ontario developments",
      sourceTypes: ["x"],
      name: "Running X",
    });
    const pausedX = await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor Lake Ontario developments",
      sourceTypes: ["x"],
      name: "Paused X",
    });
    await executor.pauseWatchBot({ watchBotId: pausedX.id });

    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "9001",
              text: "Lake Ontario developments",
              author_id: "42",
              created_at: "2026-08-29T12:00:00.000Z",
            },
          ],
          includes: { users: [{ id: "42", username: "openbento" }] },
          meta: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const provider = createXSourceProvider({
      enabled: true,
      bearerToken: "test-bearer-token",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await runWorkerCycle({
      store,
      provider,
      env: { X_MAX_REQUESTS_PER_WORKER_TICK: "1" },
    });

    expect(result.providerEligibleWatchBots).toBe(1);
    expect(result.skippedPaused).toBe(1);
    expect(result.processed).toBe(1);
    expect(runningX.id).not.toBe(pausedX.id);
  });
});

describe("WatchBot intelligence Slice D worker composition", () => {
  it("keeps passthrough and makes no model calls when the classifier gate is off", async () => {
    const { store, provider } = await seedFixtureStore();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await runWorkerCycle({
      store,
      provider,
      env: {
        WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED: "false",
        XAI_API_KEY: "test-not-a-secret",
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(result.classifierCalls).toBe(0);
    expect(result.classifierErrors).toBe(0);
    expect(result.notMeaningful).toBe(0);
    expect(result.cardsCreated).toBeGreaterThan(0);
  });

  it("keeps passthrough when the gate is on but credentials are missing", async () => {
    const { store, provider } = await seedFixtureStore();
    const result = await runWorkerCycle({
      store,
      provider,
      env: { WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED: "true" },
    });
    expect(result.classifierCalls).toBe(0);
    expect(result.notMeaningful).toBe(0);
    expect(result.cardsCreated).toBeGreaterThan(0);
  });

  it("aggregates classifier counters when a mock adapter is injected", async () => {
    const { store, provider } = await seedFixtureStore();
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    meaningful: true,
                    importanceScore: 0.8,
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const classifier = createModelMeaningfulnessClassifier({
      enabled: true,
      apiKey: "test-not-a-secret",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await runWorkerCycle({
      store,
      provider,
      meaningfulnessClassifier: classifier,
    });
    expect(result.classifierCalls).toBeGreaterThan(0);
    expect(result.classifierErrors).toBe(0);
    expect(fetchImpl).toHaveBeenCalled();
    expect(result.cardsCreated).toBeGreaterThan(0);
  });
});

describe("WatchBot intelligence Slice E OpenAI worker composition", () => {
  it("keeps passthrough and makes no OpenAI fetches when the classifier gate is off", async () => {
    const { store, provider } = await seedFixtureStore();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await runWorkerCycle({
      store,
      provider,
      env: {
        WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED: "false",
        WATCHBOT_MEANINGFULNESS_PROVIDER: "openai",
        OPENAI_API_KEY: "test-not-a-secret",
        XAI_API_KEY: "test-not-a-secret",
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(result.classifierCalls).toBe(0);
    expect(result.classifierProvider).toBeUndefined();
    expect(result.notMeaningful).toBe(0);
    expect(result.cardsCreated).toBeGreaterThan(0);
  });

  it("does not fall back to xAI when OpenAI is selected but OPENAI_API_KEY is missing", async () => {
    const { store, provider } = await seedFixtureStore();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await runWorkerCycle({
      store,
      provider,
      env: {
        WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED: "true",
        WATCHBOT_MEANINGFULNESS_PROVIDER: "openai",
        XAI_API_KEY: "test-not-a-secret",
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(result.classifierCalls).toBe(0);
    expect(result.notMeaningful).toBe(0);
    expect(result.cardsCreated).toBeGreaterThan(0);
  });

  it("does not auto-pick a vendor when both keys exist and provider is unset", async () => {
    const { store, provider } = await seedFixtureStore();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await runWorkerCycle({
      store,
      provider,
      env: {
        WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED: "true",
        OPENAI_API_KEY: "test-not-a-secret",
        XAI_API_KEY: "test-not-a-secret",
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(result.classifierCalls).toBe(0);
    expect(result.cardsCreated).toBeGreaterThan(0);
  });

  it("aggregates OpenAI classifier counters when a mock adapter is injected", async () => {
    const { store, provider } = await seedFixtureStore();
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    meaningful: true,
                    importanceScore: 0.8,
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const classifier = createOpenAIMeaningfulnessClassifier({
      enabled: true,
      apiKey: "test-not-a-secret",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await runWorkerCycle({
      store,
      provider,
      meaningfulnessClassifier: classifier,
    });
    expect(result.classifierCalls).toBeGreaterThan(0);
    expect(result.classifierErrors).toBe(0);
    expect(result.classifierProvider).toBe("openai");
    expect(result.classifierModel).toBe("gpt-5.6-luna");
    expect(fetchImpl).toHaveBeenCalled();
    expect(result.cardsCreated).toBeGreaterThan(0);
  });
});

describe("X adapter worker-tick budget", () => {
  const discoverInput = {
    canvasId: "canvas-x",
    watchBotId: "watchbot-x",
    instruction: "Monitor meaningful Lake Ontario developments",
    sourceTypes: ["x"] as WatchBotSourceType[],
  };

  it("counts actual HTTP calls through the shared budget object", async () => {
    const { XHttpBudget } = await import("@openbento/watchbot");
    const budget = new XHttpBudget(1);
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "123",
              text: "Lake Ontario update",
              author_id: "42",
              created_at: "2026-08-29T12:00:00.000Z",
            },
          ],
          includes: { users: [{ id: "42", username: "openbento" }] },
          meta: { next_token: "page2" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const provider = createXSourceProvider({
      enabled: true,
      bearerToken: "test-bearer-token",
      fetchImpl: fetchImpl as typeof fetch,
      maxPagesPerCycle: 2,
      maxRequestsPerCycle: 2,
    });

    await provider.discover({ ...discoverInput, xHttpBudget: budget });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(budget.httpRequests).toBe(1);
  });
});
