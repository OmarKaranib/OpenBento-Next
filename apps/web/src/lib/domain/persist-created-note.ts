import type { Card, CreateCardInput, Frame } from "@openbento/domain";
import type { CatalogCall } from "./inputs";
import { persistCreatedCard } from "./persist-created-card";

/**
 * Two-call Note create: `createCard`, then `setCardFrame` from geometry.
 * Used by the toolbar Note button and empty-canvas double-click.
 */
export async function persistCreatedNoteCard(
  commit: (calls: CatalogCall[]) => Promise<unknown[]>,
  input: CreateCardInput,
  frames: ReadonlyArray<Frame>,
): Promise<Card> {
  return persistCreatedCard(commit, input, frames);
}
