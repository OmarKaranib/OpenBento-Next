import type { CanvasState } from "@openbento/domain";
import type { NormalizedItem } from "./normalize";
import { jaccardSimilarity, tokenizeForScoring } from "./untrusted";

/** Prefer meaningful developments. Low overlap is rejected. */
export const RELEVANCE_THRESHOLD = 0.12;

export function scoreRelevance(
  item: NormalizedItem,
  instruction: string,
  canvas: CanvasState,
): number {
  const contextTokens = tokenizeForScoring(
    [
      instruction,
      canvas.canvas.name,
      ...canvas.cards.map((card) => {
        if (card.type === "note") {
          return card.payload.text;
        }
        if ("provenance" in card.payload) {
          return card.payload.provenance.title;
        }
        return "";
      }),
    ].join(" "),
  );
  const itemTokens = tokenizeForScoring(item.title);
  if (contextTokens.length === 0 || itemTokens.length === 0) {
    return 0;
  }
  return jaccardSimilarity(itemTokens, contextTokens);
}

export function isRelevantEnough(score: number): boolean {
  return score >= RELEVANCE_THRESHOLD;
}
