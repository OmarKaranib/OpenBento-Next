import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { InMemoryDomainStore } from "./store";
import type { WatchBotEvent } from "./types";

function discovery(
  overrides: Pick<WatchBotEvent, "id" | "watchBotId" | "dedupKey">,
): WatchBotEvent {
  return {
    id: overrides.id,
    watchBotId: overrides.watchBotId,
    canvasId: "canvas-1",
    kind: "discovered",
    sourceUrl: "https://example.com/story",
    dedupKey: overrides.dedupKey,
    discoveredAt: "2026-08-29T00:00:00.000Z",
  };
}

describe("watch_bot_events unique (watch_bot_id, dedup_key)", () => {
  it("rejects a duplicate discovery for the same watch bot", async () => {
    const store = new InMemoryDomainStore();
    await store.saveWatchBotEvent(
      discovery({
        id: "event-1",
        watchBotId: "bot-1",
        dedupKey: "web:https://example.com/story",
      }),
    );

    await expect(
      store.saveWatchBotEvent(
        discovery({
          id: "event-2",
          watchBotId: "bot-1",
          dedupKey: "web:https://example.com/story",
        }),
      ),
    ).rejects.toMatchObject({
      name: "DomainError",
      code: "conflict",
    });
    await expect(
      store.saveWatchBotEvent(
        discovery({
          id: "event-2",
          watchBotId: "bot-1",
          dedupKey: "web:https://example.com/story",
        }),
      ),
    ).rejects.toBeInstanceOf(DomainError);

    const events = await store.listWatchBotEventsByWatchBot("bot-1");
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("event-1");
  });

  it("allows a different watch bot to reuse a dedup_key", async () => {
    const store = new InMemoryDomainStore();
    const key = "web:https://example.com/story";
    await store.saveWatchBotEvent(
      discovery({ id: "event-a", watchBotId: "bot-a", dedupKey: key }),
    );
    await store.saveWatchBotEvent(
      discovery({ id: "event-b", watchBotId: "bot-b", dedupKey: key }),
    );

    const forA = await store.listWatchBotEventsByWatchBot("bot-a");
    const forB = await store.listWatchBotEventsByWatchBot("bot-b");
    expect(forA).toHaveLength(1);
    expect(forB).toHaveLength(1);
    expect(forA[0]?.dedupKey).toBe(key);
    expect(forB[0]?.dedupKey).toBe(key);
    expect(forA[0]?.watchBotId).toBe("bot-a");
    expect(forB[0]?.watchBotId).toBe("bot-b");
  });

  it("lists every WatchBot for the worker scan", async () => {
    const store = new InMemoryDomainStore();
    await store.saveWatchBot({
      id: "bot-1",
      ownerId: "user-a",
      canvasId: "canvas-1",
      instruction: "Watch",
      status: "running",
      sourceTypes: ["web"],
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    });
    await store.saveWatchBot({
      id: "bot-2",
      ownerId: "user-b",
      canvasId: "canvas-2",
      instruction: "Watch",
      status: "paused",
      sourceTypes: ["news"],
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    });
    const all = await store.listWatchBots();
    expect(all.map((bot) => bot.id).sort()).toEqual(["bot-1", "bot-2"]);
  });
});

describe("leftover-Card transaction and same-canvas event card_id", () => {
  it("rolls back a Card when the unique claim conflicts", async () => {
    const store = new InMemoryDomainStore();
    const card = {
      id: "card-orphan",
      canvasId: "canvas-1",
      type: "news" as const,
      payload: {
        provenance: {
          sourceUrl: "https://example.com/story",
          title: "Story",
          publishedAt: "2026-08-29T00:00:00.000Z",
          sourceType: "news" as const,
        },
      },
      position: { x: 0, y: 0 },
      size: { width: 10, height: 10 },
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    };
    await store.saveWatchBotEvent(
      discovery({
        id: "event-1",
        watchBotId: "bot-1",
        dedupKey: "web:https://example.com/story",
      }),
    );

    await expect(
      store.runInTransaction(async (tx) => {
        await tx.saveCard(card);
        await tx.saveWatchBotEvent(
          discovery({
            id: "event-2",
            watchBotId: "bot-1",
            dedupKey: "web:https://example.com/story",
          }),
        );
      }),
    ).rejects.toMatchObject({ code: "conflict" });

    expect(await store.getCard("card-orphan")).toBeNull();
    const events = await store.listWatchBotEventsByWatchBot("bot-1");
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("event-1");
  });

  it("does not occupy the unique key when the transaction throws before claim", async () => {
    const store = new InMemoryDomainStore();
    await expect(
      store.runInTransaction(async (tx) => {
        await tx.saveCard({
          id: "card-thrown",
          canvasId: "canvas-1",
          type: "note",
          payload: { text: "x" },
          position: { x: 0, y: 0 },
          size: { width: 10, height: 10 },
          createdAt: "2026-08-29T00:00:00.000Z",
          updatedAt: "2026-08-29T00:00:00.000Z",
        });
        throw new Error("create_failed");
      }),
    ).rejects.toThrow("create_failed");
    expect(await store.getCard("card-thrown")).toBeNull();
    expect(await store.listWatchBotEventsByWatchBot("bot-1")).toEqual([]);
  });

  it("rejects an event card_id on a different canvas", async () => {
    const store = new InMemoryDomainStore();
    await store.saveCard({
      id: "card-other",
      canvasId: "canvas-b",
      type: "note",
      payload: { text: "other" },
      position: { x: 0, y: 0 },
      size: { width: 10, height: 10 },
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    });
    await expect(
      store.saveWatchBotEvent({
        ...discovery({
          id: "event-cross",
          watchBotId: "bot-1",
          dedupKey: "web:cross",
        }),
        canvasId: "canvas-a",
        cardId: "card-other",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
