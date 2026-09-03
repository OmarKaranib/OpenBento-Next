import { describe, expect, it } from "vitest";
import { createActionExecutor } from "./executor";
import { createSqlContractAdapter } from "./sql-adapter";
import { SharedSqlTables } from "./sql-contract";
import { SupabaseDomainStore } from "./supabase-store";
import type { Card, WatchBotEvent } from "./types";

const STAMP = "2026-08-29T00:00:00.000Z";

function pair() {
  const tables = new SharedSqlTables();
  const storeA = new SupabaseDomainStore(
    createSqlContractAdapter(tables, { ownerId: "user-a" }),
  );
  const storeB = new SupabaseDomainStore(
    createSqlContractAdapter(tables, { ownerId: "user-b" }),
  );
  return {
    tables,
    storeA,
    storeB,
    a: createActionExecutor({ store: storeA, ownerId: "user-a" }),
    b: createActionExecutor({ store: storeB, ownerId: "user-b" }),
  };
}

const provenance = {
  sourceUrl: "https://news.example.com/story",
  title: "Story",
  publishedAt: STAMP,
  sourceType: "news" as const,
};

describe("SupabaseDomainStore SQL-contract double", () => {
  it("blocks IDOR: user B cannot read or mutate user A objects", async () => {
    const { storeA, storeB, a, b } = pair();
    const canvas = await a.createCanvas({ name: "Alpha" });
    const card = await a.createCard({
      canvasId: canvas.id,
      type: "note",
      payload: { text: "secret" },
    });
    const frame = await a.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    });
    const bot = await a.createWatchBot({
      canvasId: canvas.id,
      instruction: "Watch",
    });

    expect(await storeB.getCanvas(canvas.id)).toBeNull();
    expect(await storeB.getCard(card.id)).toBeNull();
    expect(await storeB.getFrame(frame.id)).toBeNull();
    expect(await storeB.getWatchBot(bot.id)).toBeNull();
    expect(await storeB.listCanvasesByOwner("user-a")).toEqual([]);
    expect(await storeB.listCardsByCanvas(canvas.id)).toEqual([]);

    await expect(b.getCanvasState({ canvasId: canvas.id })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      b.renameCanvas({ canvasId: canvas.id, name: "Hijack" }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      b.moveCard({ cardId: card.id, position: { x: 9, y: 9 } }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(b.deleteCard({ cardId: card.id })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(b.deleteFrame({ frameId: frame.id })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      b.deleteCanvas({ canvasId: canvas.id }),
    ).rejects.toMatchObject({ code: "not_found" });

    const still = await storeA.getCanvas(canvas.id);
    expect(still?.name).toBe("Alpha");
    expect(still?.ownerId).toBe("user-a");
  });

  it("keeps Frame/Card ownership on the same canvas and user", async () => {
    const { a } = pair();
    const one = await a.createCanvas({ name: "One" });
    const two = await a.createCanvas({ name: "Two" });
    const card = await a.createCard({
      canvasId: one.id,
      type: "note",
      payload: { text: "note" },
    });
    const frame = await a.createFrame({
      canvasId: two.id,
      bounds: { x: 0, y: 0, width: 80, height: 80 },
    });
    await expect(
      a.setCardFrame({ cardId: card.id, frameId: frame.id }),
    ).rejects.toMatchObject({ name: "SameCanvasMembershipError" });
    const state = await a.getCanvasState({ canvasId: one.id });
    expect(state.cards[0]?.frameId ?? null).toBeNull();
  });

  it("stores watch_bot_events.published_at as null when publishedAt is empty", async () => {
    const { tables, storeA, a } = pair();
    const canvas = await a.createCanvas({ name: "Undated" });
    const bot = await a.createWatchBot({
      canvasId: canvas.id,
      instruction: "Watch",
    });
    const card = await a.createCard({
      canvasId: canvas.id,
      type: "news",
      payload: { provenance: { ...provenance, publishedAt: "" } },
    });
    await storeA.saveWatchBotEvent({
      id: "event-undated",
      watchBotId: bot.id,
      canvasId: canvas.id,
      kind: "card_created",
      sourceUrl: provenance.sourceUrl,
      dedupKey: "news:https://news.example.com/story",
      discoveredAt: STAMP,
      publishedAt: "",
      cardId: card.id,
    });
    const row = tables.watchBotEvents.get("event-undated");
    expect(row?.published_at).toBeNull();
    expect(row?.published_at).not.toBe("");
    const stored = await storeA.getCard(card.id);
    expect(stored?.type).toBe("news");
    if (stored && "provenance" in stored.payload) {
      expect(stored.payload.provenance.publishedAt).toBe("");
    }
  });

  it("enforces unique (watch_bot_id, dedup_key) after create", async () => {
    const { storeA, a } = pair();
    const canvas = await a.createCanvas({ name: "Watch" });
    const bot = await a.createWatchBot({
      canvasId: canvas.id,
      instruction: "Watch",
    });
    const card = await a.createCard({
      canvasId: canvas.id,
      type: "news",
      payload: { provenance },
    });
    const event: WatchBotEvent = {
      id: "event-1",
      watchBotId: bot.id,
      canvasId: canvas.id,
      kind: "card_created",
      sourceUrl: provenance.sourceUrl,
      dedupKey: "news:https://news.example.com/story",
      discoveredAt: STAMP,
      cardId: card.id,
    };
    await storeA.saveWatchBotEvent(event);
    await expect(
      storeA.saveWatchBotEvent({ ...event, id: "event-2" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await storeA.listWatchBotEventsByWatchBot(bot.id)).toHaveLength(1);
  });

  it("rolls back leftover Card when unique claim conflicts in one transaction", async () => {
    const { storeA, a } = pair();
    const canvas = await a.createCanvas({ name: "Txn" });
    const bot = await a.createWatchBot({
      canvasId: canvas.id,
      instruction: "Watch",
    });
    await storeA.saveWatchBotEvent({
      id: "claimed",
      watchBotId: bot.id,
      canvasId: canvas.id,
      kind: "discovered",
      sourceUrl: provenance.sourceUrl,
      dedupKey: "news:https://news.example.com/story",
      discoveredAt: STAMP,
    });

    const card: Card = {
      id: "card-leftover",
      canvasId: canvas.id,
      type: "news",
      payload: { provenance },
      position: { x: 0, y: 0 },
      size: { width: 10, height: 10 },
      createdAt: STAMP,
      updatedAt: STAMP,
    };

    await expect(
      storeA.runInTransaction(async (tx) => {
        await tx.saveCard(card);
        await tx.saveWatchBotEvent({
          id: "claim-2",
          watchBotId: bot.id,
          canvasId: canvas.id,
          kind: "card_created",
          sourceUrl: provenance.sourceUrl,
          dedupKey: "news:https://news.example.com/story",
          discoveredAt: STAMP,
          cardId: card.id,
        });
      }),
    ).rejects.toMatchObject({ code: "conflict" });

    expect(await storeA.getCard("card-leftover")).toBeNull();
    expect(await storeA.listCardsByCanvas(canvas.id)).toEqual([]);
  });

  it("rejects watch_bot_events.card_id on a different canvas", async () => {
    const { storeA, a } = pair();
    const canvasA = await a.createCanvas({ name: "A" });
    const canvasB = await a.createCanvas({ name: "B" });
    const bot = await a.createWatchBot({
      canvasId: canvasA.id,
      instruction: "Watch",
    });
    const foreign = await a.createCard({
      canvasId: canvasB.id,
      type: "note",
      payload: { text: "other canvas" },
    });
    await expect(
      storeA.saveWatchBotEvent({
        id: "cross",
        watchBotId: bot.id,
        canvasId: canvasA.id,
        kind: "card_created",
        sourceUrl: "https://example.com/x",
        dedupKey: "web:cross",
        discoveredAt: STAMP,
        cardId: foreign.id,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("mirrors Card SET NULL, Frame restrict/cleanup, and Canvas cascades", async () => {
    const { tables, storeA, a } = pair();
    const canvas = await a.createCanvas({ name: "Delete contract" });
    const card = await a.createCard({
      canvasId: canvas.id,
      type: "news",
      payload: { provenance },
      position: { x: 30, y: 40 },
      size: { width: 300, height: 190 },
    });
    const frame = await a.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 400, height: 300 },
    });
    const bot = await a.createWatchBot({
      canvasId: canvas.id,
      instruction: "Watch",
    });
    await a.setCardFrame({ cardId: card.id, frameId: frame.id });
    await storeA.saveWatchBotEvent({
      id: "event-delete",
      watchBotId: bot.id,
      canvasId: canvas.id,
      kind: "card_created",
      sourceUrl: provenance.sourceUrl,
      dedupKey: "news:delete",
      discoveredAt: STAMP,
      cardId: card.id,
    });

    await expect(storeA.deleteFrame(frame.id)).rejects.toMatchObject({
      code: "invalid_input",
    });
    const geometry = { position: card.position, size: card.size };
    await a.deleteFrame({ frameId: frame.id });
    expect(await storeA.getFrame(frame.id)).toBeNull();
    const detached = await storeA.getCard(card.id);
    expect(detached?.frameId ?? null).toBeNull();
    expect(detached?.position).toEqual(geometry.position);
    expect(detached?.size).toEqual(geometry.size);

    await a.deleteCard({ cardId: card.id });
    expect(tables.watchBotEvents.get("event-delete")?.card_id).toBeNull();
    expect(await storeA.listWatchBotEventsByWatchBot(bot.id)).toHaveLength(1);

    await a.deleteCanvas({ canvasId: canvas.id });
    expect(tables.canvases.has(canvas.id)).toBe(false);
    expect(tables.watchBots.has(bot.id)).toBe(false);
    expect(tables.watchBotEvents.has("event-delete")).toBe(false);
  });

  it("restores canvas state after reload against the same store", async () => {
    const { tables, a } = pair();
    const canvas = await a.createCanvas({ name: "Restore me" });
    await a.updateCanvasViewport({
      canvasId: canvas.id,
      viewport: { x: 12, y: -4, zoom: 1.5 },
    });
    const card = await a.createCard({
      canvasId: canvas.id,
      type: "note",
      payload: { text: "kept" },
      position: { x: 8, y: 9 },
    });
    const frame = await a.createFrame({
      canvasId: canvas.id,
      name: "Main",
      bounds: { x: 0, y: 0, width: 200, height: 160 },
    });
    await a.setCardFrame({ cardId: card.id, frameId: frame.id });
    await a.createWatchBot({
      canvasId: canvas.id,
      instruction: "Keep watching",
      name: "Bot",
    });

    const reloaded = new SupabaseDomainStore(
      createSqlContractAdapter(tables, { ownerId: "user-a" }),
    );
    const again = createActionExecutor({ store: reloaded, ownerId: "user-a" });
    const listed = await reloaded.listCanvasesByOwner("user-a");
    expect(listed.map((row) => row.id)).toContain(canvas.id);
    const state = await again.getCanvasState({ canvasId: canvas.id });
    expect(state.canvas.name).toBe("Restore me");
    expect(state.canvas.viewport).toEqual({ x: 12, y: -4, zoom: 1.5 });
    expect(state.cards).toHaveLength(1);
    expect(state.cards[0]?.payload).toEqual({ text: "kept" });
    expect(state.cards[0]?.frameId).toBe(frame.id);
    expect(state.frames[0]?.name).toBe("Main");
    expect(state.watchBots[0]?.instruction).toBe("Keep watching");
  });
});
