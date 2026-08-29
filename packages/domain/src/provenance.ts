import {
  SOURCE_CARD_TYPES,
  type CardPayload,
  type CardProvenance,
  type CardType,
  type NotePayload,
  type SourceCardPayload,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Provenance is required only for externally discovered source Cards. */
export function cardTypeRequiresProvenance(type: CardType): boolean {
  return (SOURCE_CARD_TYPES as readonly CardType[]).includes(type);
}

export function isNoteCardType(type: CardType): boolean {
  return type === "note";
}

export function isCardProvenance(value: unknown): value is CardProvenance {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.sourceUrl === "string" &&
    value.sourceUrl.length > 0 &&
    typeof value.title === "string" &&
    typeof value.publishedAt === "string" &&
    typeof value.sourceType === "string"
  );
}

export function isValidNotePayload(payload: unknown): payload is NotePayload {
  return (
    isRecord(payload) &&
    typeof payload.text === "string" &&
    !("provenance" in payload)
  );
}

export function isValidSourcePayload(
  payload: unknown,
): payload is SourceCardPayload {
  return isRecord(payload) && isCardProvenance(payload.provenance);
}

export function isValidCardPayload(
  type: CardType,
  payload: unknown,
): payload is CardPayload {
  if (isNoteCardType(type)) {
    return isValidNotePayload(payload);
  }
  if (cardTypeRequiresProvenance(type)) {
    return isValidSourcePayload(payload);
  }
  return isRecord(payload);
}
