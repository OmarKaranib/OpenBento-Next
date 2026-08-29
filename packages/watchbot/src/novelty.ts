import type { WatchBotEvent } from "@openbento/domain";
import type { NormalizedItem } from "./normalize";
import { jaccardSimilarity, tokenizeForScoring } from "./untrusted";

/** Below this score the item is treated as a restatement, not a new development. */
export const NOVELTY_THRESHOLD = 0.35;

export function scoreNovelty(
  item: NormalizedItem,
  priorEvents: readonly WatchBotEvent[],
): number {
  const prior = priorEvents.filter(
    (event) =>
      event.kind === "card_created" ||
      event.kind === "novel" ||
      event.kind === "normalized",
  );
  if (prior.length === 0) {
    return 1;
  }
  const itemTokens = tokenizeForScoring(`${item.title} ${item.snippet}`);
  let bestOverlap = 0;
  for (const event of prior) {
    const eventTokens = tokenizeForScoring(
      `${event.title ?? ""} ${event.sourceUrl}`,
    );
    const overlap = jaccardSimilarity(itemTokens, eventTokens);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
    }
  }
  return 1 - bestOverlap;
}

export function isNovelEnough(score: number): boolean {
  return score >= NOVELTY_THRESHOLD;
}
