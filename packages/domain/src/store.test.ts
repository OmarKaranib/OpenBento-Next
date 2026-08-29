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
});
