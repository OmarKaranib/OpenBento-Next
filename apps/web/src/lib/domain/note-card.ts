import type { CreateCardInput, Point, Size } from "@openbento/domain";
import { isValidCardPayload } from "@openbento/domain";

/** Default Note Card size. Camera zoom must not change this stored geometry. */
export const NOTE_DEFAULT_SIZE: Size = { width: 240, height: 160 };

/**
 * UI path for creating a Note Card.
 * Always emits discriminated `{ type: "note", payload: NotePayload }`.
 * Never send a source/YouTube payload on this path.
 */
export function buildCreateNoteCardInput(args: {
  canvasId: string;
  position?: Point;
  size?: Size;
  text?: string;
}): CreateCardInput {
  const payload = { text: args.text ?? "" };
  if (!isValidCardPayload("note", payload)) {
    throw new Error("Note payload failed PAYLOAD_SCHEMAS.note");
  }
  return {
    canvasId: args.canvasId,
    type: "note",
    payload,
    ...(args.position ? { position: args.position } : {}),
    size: args.size ?? NOTE_DEFAULT_SIZE,
  };
}
