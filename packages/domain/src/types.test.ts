import { describe, expect, it } from "vitest";
import type { CreateCardInput, UpdateCardInput } from "./actions";
import type { Card } from "./types";

const sourcePayload = {
  provenance: {
    sourceUrl: "https://youtube.com/watch?v=1",
    title: "Video",
    publishedAt: "2026-08-01T00:00:00.000Z",
    sourceType: "youtube" as const,
  },
};

const _noteCard: Card = {
  id: "card-note",
  canvasId: "canvas-1",
  type: "note",
  payload: { text: "hello" },
  position: { x: 0, y: 0 },
  size: { width: 120, height: 80 },
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const _youtubeCard: Card = {
  id: "card-yt",
  canvasId: "canvas-1",
  type: "youtube",
  payload: sourcePayload,
  position: { x: 0, y: 0 },
  size: { width: 320, height: 180 },
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const _createNote: CreateCardInput = {
  canvasId: "canvas-1",
  type: "note",
  payload: { text: "hello" },
};

const _createYoutube: CreateCardInput = {
  canvasId: "canvas-1",
  type: "youtube",
  payload: sourcePayload,
};

const _updateNote: UpdateCardInput = {
  cardId: "card-note",
  type: "note",
  payload: { text: "updated" },
};

// @ts-expect-error note cannot carry a YouTube/source payload
const _badNoteCard: Card = {
  id: "bad-note",
  canvasId: "canvas-1",
  type: "note",
  payload: sourcePayload,
  position: { x: 0, y: 0 },
  size: { width: 120, height: 80 },
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

// @ts-expect-error youtube cannot carry a note `{ text }` payload
const _badYoutubeCard: Card = {
  id: "bad-yt",
  canvasId: "canvas-1",
  type: "youtube",
  payload: { text: "hello" },
  position: { x: 0, y: 0 },
  size: { width: 320, height: 180 },
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

// @ts-expect-error note cannot carry a YouTube/source payload
const _badCreateNote: CreateCardInput = {
  canvasId: "canvas-1",
  type: "note",
  payload: sourcePayload,
};

// @ts-expect-error youtube cannot carry a note `{ text }` payload
const _badCreateYoutube: CreateCardInput = {
  canvasId: "canvas-1",
  type: "youtube",
  payload: { text: "hello" },
};

// @ts-expect-error note cannot carry a YouTube/source payload
const _badUpdateNote: UpdateCardInput = {
  cardId: "card-note",
  type: "note",
  payload: sourcePayload,
};

// @ts-expect-error youtube cannot carry a note `{ text }` payload
const _badUpdateYoutube: UpdateCardInput = {
  cardId: "card-yt",
  type: "youtube",
  payload: { text: "hello" },
};

describe("discriminated Card model", () => {
  it("accepts matching type/payload pairs", () => {
    expect(_noteCard.type).toBe("note");
    expect(_youtubeCard.type).toBe("youtube");
    expect(_createNote.type).toBe("note");
    expect(_createYoutube.type).toBe("youtube");
    expect(_updateNote.type).toBe("note");
  });
});
