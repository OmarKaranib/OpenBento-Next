import { describe, expect, it } from "vitest";
import {
  createActionExecutor,
  InMemoryDomainStore,
  isValidCardPayload,
} from "@openbento/domain";
import { buildCreateNoteCardInput } from "./note-card";

describe("UI createCard path is Note-only", () => {
  it("builds a discriminated note + NotePayload and persists via createCard", async () => {
    const executor = createActionExecutor({
      store: new InMemoryDomainStore(),
      ownerId: "local-session",
    });
    const canvas = await executor.createCanvas({ name: "Story" });
    const input = buildCreateNoteCardInput({
      canvasId: canvas.id,
      position: { x: 40, y: 80 },
      text: "Follow this story",
    });

    expect(input.type).toBe("note");
    expect(input.payload).toEqual({ text: "Follow this story" });
    expect(input.payload).not.toHaveProperty("provenance");
    expect(isValidCardPayload("note", input.payload)).toBe(true);
    expect(isValidCardPayload("youtube", input.payload)).toBe(false);

    const card = await executor.execute("createCard", input);
    expect(card.type).toBe("note");
    expect(card.payload).toEqual({ text: "Follow this story" });
    expect(card.position).toEqual({ x: 40, y: 80 });
    expect(card.size).toEqual({ width: 240, height: 160 });
  });

  it("rejects a note-typed payload that is not NotePayload", async () => {
    const executor = createActionExecutor({
      store: new InMemoryDomainStore(),
      ownerId: "local-session",
    });
    const canvas = await executor.createCanvas({ name: "Story" });
    await expect(
      executor.createCard({
        canvasId: canvas.id,
        type: "note",
        payload: {
          provenance: {
            sourceUrl: "https://youtube.com/watch?v=1",
            title: "Video",
            publishedAt: "2026-08-01T00:00:00.000Z",
            sourceType: "youtube",
          },
        },
      } as never),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
