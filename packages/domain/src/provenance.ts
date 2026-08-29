import { SOURCE_CARD_TYPES, type CardType } from "./types";

export {
  isCardProvenance,
  isValidCardPayload,
  isValidNotePayload,
  isValidSourcePayload,
} from "./payloads";

/** Provenance is required only for externally discovered source Cards. */
export function cardTypeRequiresProvenance(type: CardType): boolean {
  return (SOURCE_CARD_TYPES as readonly CardType[]).includes(type);
}

export function isNoteCardType(type: CardType): boolean {
  return type === "note";
}
