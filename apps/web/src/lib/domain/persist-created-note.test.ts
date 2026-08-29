import { describe, expect, it } from "vitest";
import {
  createActionExecutor,
  InMemoryDomainStore,
} from "@openbento/domain";
import { buildCreateNoteCardInput } from "./note-card";
import { persistCreatedNoteCard } from "./persist-created-note";
import type { CatalogCall } from "./inputs";

describe("pane / toolbar Note create is two catalog calls", () => {
  it("creates a Note at world coordinates then setCardFrame from geometry", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const frame = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 400, height: 300 },
      name: "Main",
    });

    const names: CatalogCall["name"][] = [];
    const commit = async (calls: CatalogCall[]) => {
      const results: unknown[] = [];
      for (const call of calls) {
        names.push(call.name);
        results.push(await executor.execute(call.name, call.input));
      }
      return results;
    };

    const world = { x: 128, y: 96 };
    const card = await persistCreatedNoteCard(
      commit,
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        position: world,
        text: "",
      }),
      [frame],
    );

    expect(card.type).toBe("note");
    expect(card.position).toEqual(world);
    expect(card.frameId ?? null).toBeNull();
    expect(names).toEqual(["createCard", "setCardFrame"]);

    const attached = await executor.getCanvasState({ canvasId: canvas.id });
    expect(attached.cards[0]?.position).toEqual(world);
    expect(attached.cards[0]?.frameId).toBe(frame.id);
  });

  it("skips setCardFrame when the click is outside every Frame", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const frame = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 80, height: 80 },
    });

    const names: CatalogCall["name"][] = [];
    const commit = async (calls: CatalogCall[]) => {
      const results: unknown[] = [];
      for (const call of calls) {
        names.push(call.name);
        results.push(await executor.execute(call.name, call.input));
      }
      return results;
    };

    const world = { x: 500, y: 400 };
    const card = await persistCreatedNoteCard(
      commit,
      buildCreateNoteCardInput({
        canvasId: canvas.id,
        position: world,
        text: "",
      }),
      [frame],
    );

    expect(card.position).toEqual(world);
    expect(card.frameId ?? null).toBeNull();
    expect(names).toEqual(["createCard"]);
  });
});
