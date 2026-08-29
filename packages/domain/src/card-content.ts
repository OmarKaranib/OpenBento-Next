import { DomainError } from "./errors";
import { isValidCardPayload } from "./payloads";
import type {
  Card,
  CardType,
  DiscriminatedCardContent,
} from "./types";

/**
 * Couple type + payload after `isValidCardPayload` so Card stays discriminated.
 */
export function cardContentOf(
  type: CardType,
  payload: unknown,
): DiscriminatedCardContent {
  if (!isValidCardPayload(type, payload)) {
    throw new DomainError(
      "invalid_input",
      `Payload does not match PAYLOAD_SCHEMAS for type ${type}`,
    );
  }
  return { type, payload } as DiscriminatedCardContent;
}

export function cardFromContent(
  base: Omit<Card, keyof DiscriminatedCardContent>,
  content: DiscriminatedCardContent,
): Card {
  return { ...base, ...content };
}
