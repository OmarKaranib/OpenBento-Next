import type { CanvasState } from "@openbento/domain";
import type { NormalizedItem } from "./normalize";
import {
  deriveRelevanceIntent,
  relevanceLaneForSourceType,
} from "./relevance-intent";
import {
  jaccardSimilarity,
  tokenizeForScoring,
  tokenizeItemForProviderRelevance,
} from "./untrusted";

/** Prefer meaningful developments. Low overlap is rejected. */
export const RELEVANCE_THRESHOLD = 0.12;

export interface RelevanceContext {
  /** Candidate source type. Defaults to `item.sourceType`. */
  sourceType?: NormalizedItem["sourceType"];
}

export function scoreRelevance(
  item: NormalizedItem,
  instruction: string,
  canvas: CanvasState,
  context?: RelevanceContext,
): number {
  const sourceType = context?.sourceType ?? item.sourceType;
  if (relevanceLaneForSourceType(sourceType) === "provider_filtered") {
    return scoreProviderFilteredRelevance(item, instruction, sourceType);
  }
  return scoreNaturalLanguageRelevance(item, instruction, canvas);
}

/**
 * Ordinary WatchBots: Jaccard of item title vs raw instruction + canvas text.
 * Do not change this path for web/news natural-language monitors.
 */
function scoreNaturalLanguageRelevance(
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

/**
 * Provider already applied the structured query. Score against derived
 * positive intent terms only — never operator/exclusion tokens — and use
 * query-term recall so long posts are not killed by thin Jaccard overlap.
 * Items that share no positive intent term are rejected.
 * Empty derived intent (operator-only or short tokens stripped below
 * the scorer's length floor) is reject, not a raw-instruction fallback —
 * that fallback would treat `retweet` and other operators as positives.
 */
function scoreProviderFilteredRelevance(
  item: NormalizedItem,
  instruction: string,
  sourceType: string,
): number {
  const derived = deriveRelevanceIntent(instruction, sourceType);
  const intentTokens = uniqueTokens(tokenizeForScoring(derived.intentText));
  if (intentTokens.length === 0) {
    return 0;
  }
  const itemTokens = uniqueTokens(tokenizeItemForProviderRelevance(item.title));
  if (itemTokens.length === 0) {
    return 0;
  }
  const intentSet = new Set(intentTokens);
  const itemSet = new Set(itemTokens);
  let hits = 0;
  for (const token of intentSet) {
    if (itemSet.has(token)) {
      hits += 1;
    }
  }
  if (hits === 0) {
    return 0;
  }
  const recall = hits / intentSet.size;
  return Math.max(recall, jaccardSimilarity(itemTokens, intentTokens));
}

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

export function isRelevantEnough(score: number): boolean {
  return score >= RELEVANCE_THRESHOLD;
}
