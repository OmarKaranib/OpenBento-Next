import { describe, expect, it } from "vitest";
import type { CreateCardInput, UpdateCardInput } from "./actions";
import type {
  Card,
  CardProvenance,
  NotePayload,
  SourceCardPayload,
} from "./types";

type Extends<A, B> = [A] extends [B] ? true : false;
type ExpectTrue<T extends true> = T;
type ExpectFalse<T extends false> = T;

type CardBase = {
  id: string;
  canvasId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
};

type NotePair = { type: "note"; payload: NotePayload };
type YoutubePair = { type: "youtube"; payload: SourceCardPayload };
type NoteWithYoutubePayload = { type: "note"; payload: SourceCardPayload };
type YoutubeWithNotePayload = { type: "youtube"; payload: NotePayload };

type _CardAcceptsNote = ExpectTrue<Extends<CardBase & NotePair, Card>>;
type _CardAcceptsYoutube = ExpectTrue<Extends<CardBase & YoutubePair, Card>>;
type _CardRejectsNoteWithSource = ExpectFalse<
  Extends<CardBase & NoteWithYoutubePayload, Card>
>;
type _CardRejectsYoutubeWithText = ExpectFalse<
  Extends<CardBase & YoutubeWithNotePayload, Card>
>;

type _CreateAcceptsNote = ExpectTrue<
  Extends<{ canvasId: string } & NotePair, CreateCardInput>
>;
type _CreateAcceptsYoutube = ExpectTrue<
  Extends<{ canvasId: string } & YoutubePair, CreateCardInput>
>;
type _CreateRejectsNoteWithSource = ExpectFalse<
  Extends<{ canvasId: string } & NoteWithYoutubePayload, CreateCardInput>
>;
type _CreateRejectsYoutubeWithText = ExpectFalse<
  Extends<{ canvasId: string } & YoutubeWithNotePayload, CreateCardInput>
>;

type _UpdateAcceptsNote = ExpectTrue<
  Extends<{ cardId: string } & NotePair, UpdateCardInput>
>;
type _UpdateAcceptsYoutube = ExpectTrue<
  Extends<{ cardId: string } & YoutubePair, UpdateCardInput>
>;
type _UpdateRejectsNoteWithSource = ExpectFalse<
  Extends<{ cardId: string } & NoteWithYoutubePayload, UpdateCardInput>
>;
type _UpdateRejectsYoutubeWithText = ExpectFalse<
  Extends<{ cardId: string } & YoutubeWithNotePayload, UpdateCardInput>
>;

const sourceProvenance: CardProvenance = {
  sourceUrl: "https://youtube.com/watch?v=1",
  title: "Video",
  publishedAt: "2026-08-01T00:00:00.000Z",
  sourceType: "youtube",
};

const sourcePayload: SourceCardPayload = {
  provenance: sourceProvenance,
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

describe("discriminated Card model", () => {
  it("accepts matching type/payload pairs", () => {
    expect(_noteCard.type).toBe("note");
    expect(_youtubeCard.type).toBe("youtube");
    expect(_createNote.type).toBe("note");
    expect(_createYoutube.type).toBe("youtube");
    expect(_updateNote.type).toBe("note");
  });
});
