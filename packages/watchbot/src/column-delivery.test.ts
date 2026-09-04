import { describe, expect, it } from "vitest";
import {
  createActionExecutor,
  InMemoryDomainStore,
  orderColumnCardsNewestFirst,
} from "@openbento/domain";
import { FakeSourceProvider } from "./fake-provider";
import { runWatchBotPipeline } from "./pipeline";

describe("WatchBot dedicated Column delivery", () => {
  it("does not call a provider while the dedicated Column is parked", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "owner" });
    const canvas = await executor.createCanvas({ name: "Watch" });
    const bot = await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor OpenBento developments",
      sourceTypes: ["news"],
    });
    await executor.moveColumn({
      columnId: bot.columnId,
      position: { x: 1700, y: 0 },
    });
    const provider = new FakeSourceProvider([]);
    const result = await runWatchBotPipeline({
      watchBot: bot,
      executor,
      store,
      provider,
    });
    expect(result).toMatchObject({ skipped: true, skipReason: "parked_column" });
    expect(provider.discoverCalls).toBe(0);
  });

  it("publishes into the dedicated Column and leaves a detached Card detached", async () => {
    const store = new InMemoryDomainStore();
    let tick = 0;
    const executor = createActionExecutor({
      store,
      ownerId: "owner",
      now: () => `2026-09-04T00:00:0${tick++}.000Z`,
    });
    const canvas = await executor.createCanvas({ name: "Watch" });
    const bot = await executor.createWatchBot({
      canvasId: canvas.id,
      instruction: "Monitor OpenBento developments",
      sourceTypes: ["news"],
    });
    const provider = new FakeSourceProvider([
      {
        sourceUrl: "https://example.com/openbento-one",
        title: "OpenBento launches first update",
        publishedAt: "2026-09-04T00:00:00.000Z",
        sourceType: "news",
        rawExcerpt: "OpenBento product development update",
      },
    ]);
    await runWatchBotPipeline({ watchBot: bot, executor, store, provider });
    let state = await executor.getCanvasState({ canvasId: canvas.id });
    const first = state.cards[0]!;
    expect(first.columnId).toBe(bot.columnId);

    await executor.detachCardFromColumn({
      cardId: first.id,
      position: { x: 900, y: 300 },
    });
    provider.setItems([
      {
        sourceUrl: "https://example.com/openbento-two",
        title: "OpenBento ships second major update",
        publishedAt: "2026-09-04T00:01:00.000Z",
        sourceType: "news",
        rawExcerpt: "A distinct OpenBento product development update",
      },
    ]);
    await runWatchBotPipeline({ watchBot: bot, executor, store, provider });
    state = await executor.getCanvasState({ canvasId: canvas.id });
    const persistedFirst = state.cards.find((card) => card.id === first.id);
    expect(persistedFirst?.columnId).toBeNull();
    expect(persistedFirst?.position).toEqual({ x: 900, y: 300 });
    const stream = orderColumnCardsNewestFirst(
      state.cards.filter((card) => card.columnId === bot.columnId),
    );
    expect(stream).toHaveLength(1);
    expect(state.cards).toHaveLength(2);
  });
});
