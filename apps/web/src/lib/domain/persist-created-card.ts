import type { Card, CreateCardInput, Frame } from "@openbento/domain";
import type { CatalogCall } from "./inputs";
import { membershipCallsForCards } from "./membership";

/**
 * Two-call Card create: `createCard`, then `setCardFrame` from geometry.
 * Shared by Note and source Cards. Does not write frameId inside createCard.
 */
export async function persistCreatedCard(
  commit: (calls: CatalogCall[]) => Promise<unknown[]>,
  input: CreateCardInput,
  frames: ReadonlyArray<Frame>,
): Promise<Card> {
  const created = await commit([{ name: "createCard", input }]);
  const card = created[0] as Card;
  const membership = membershipCallsForCards([card], frames);
  if (membership.length > 0) {
    await commit(
      membership.map((change) => ({
        name: "setCardFrame" as const,
        input: change,
      })),
    );
  }
  return card;
}
