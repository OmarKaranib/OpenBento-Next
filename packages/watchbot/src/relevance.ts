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
 * Ordinary WatchBots score source evidence (title + excerpt) against focused
 * instruction concepts. Unlike title↔full-instruction Jaccard, this does not
 * dilute an obvious match merely because an operator adds valid monitoring
 * clauses. Canvas context remains a separate signal.
 *
 * A focused instruction ("Focus on ...") requires two distinct positive
 * concept matches. This preserves a useful subject + development signal for
 * long monitors such as Iran, instead of accepting a page that says only
 * "Iran". Explicit avoid/exclude terms reject thin matches such as travel,
 * entertainment, or generic history, but do not reject a source with enough
 * positive evidence to establish a substantive development.
 */
function scoreNaturalLanguageRelevance(
  item: NormalizedItem,
  instruction: string,
  canvas: CanvasState,
): number {
  const titleTokens = uniqueTokens(tokenizeForScoring(item.title));
  const snippetTokens = uniqueTokens(tokenizeForScoring(item.snippet));
  const evidenceTokens = uniqueTokens([...titleTokens, ...snippetTokens]);
  if (evidenceTokens.length === 0) {
    return 0;
  }

  const concepts = focusedInstructionConcepts(instruction);
  const canvasContextTokens = tokenizeForScoring(canvasContextText(canvas));
  const isThinExplicitlyExcluded = hasThinExplicitlyExcludedEvidence(
    evidenceTokens,
    concepts,
  );

  const instructionScore = scoreFocusedInstructionEvidence(
    titleTokens,
    snippetTokens,
    concepts,
  );
  const canvasScore =
    isThinExplicitlyExcluded || canvasContextTokens.length === 0
      ? 0
      : jaccardSimilarity(titleTokens, canvasContextTokens);

  return Math.max(instructionScore, canvasScore);
}

const GENERIC_INSTRUCTION_TOKENS = new Set([
  "and",
  "about",
  "avoid",
  "develop",
  "for",
  "follow",
  "focus",
  "from",
  "important",
  "into",
  "major",
  "meaningful",
  "monitor",
  "news",
  "the",
  "with",
]);

type FocusedInstructionConcepts = {
  positive: string[];
  negative: string[];
  requiredMatches: number;
};

function focusedInstructionConcepts(
  instruction: string,
): FocusedInstructionConcepts {
  const { positiveText, negativeText } = splitAvoidClause(instruction);
  const positive = uniqueTokens(tokenizeForScoring(positiveText)).filter(
    (token) => !GENERIC_INSTRUCTION_TOKENS.has(token),
  );
  const negative = uniqueTokens(tokenizeForScoring(negativeText)).filter(
    (token) => !GENERIC_INSTRUCTION_TOKENS.has(token),
  );
  return {
    positive,
    negative,
    requiredMatches: /\bfocus\s+on\b/i.test(positiveText) ? 2 : 1,
  };
}

/** Split an operator's explicit avoid/exclude list without interpreting it. */
function splitAvoidClause(instruction: string): {
  positiveText: string;
  negativeText: string;
} {
  const match = /\b(?:avoid|exclude|excluding)\b/i.exec(instruction);
  if (!match || match.index === undefined) {
    return { positiveText: instruction, negativeText: "" };
  }
  return {
    positiveText: instruction.slice(0, match.index),
    negativeText: instruction.slice(match.index + match[0].length),
  };
}

function scoreFocusedInstructionEvidence(
  titleTokens: string[],
  snippetTokens: string[],
  concepts: FocusedInstructionConcepts,
): number {
  if (concepts.positive.length === 0) {
    return 0;
  }

  const positive = new Set(concepts.positive);
  const evidence = uniqueTokens([...titleTokens, ...snippetTokens]);
  const matchedPositive = evidence.filter((token) => positive.has(token));
  if (matchedPositive.length < concepts.requiredMatches) {
    return 0;
  }

  if (hasThinExplicitlyExcludedEvidence(evidence, concepts)) {
    return 0;
  }

  return Math.max(
    candidateEvidenceCoverage(titleTokens, positive),
    candidateEvidenceCoverage(snippetTokens, positive),
  );
}

function hasThinExplicitlyExcludedEvidence(
  evidenceTokens: string[],
  concepts: FocusedInstructionConcepts,
): boolean {
  const positive = new Set(concepts.positive);
  const negative = new Set(concepts.negative);
  const positiveMatches = evidenceTokens.filter((token) => positive.has(token));
  const negativeMatches = evidenceTokens.filter((token) => negative.has(token));
  return (
    negativeMatches.length > 0 &&
    positiveMatches.length <= concepts.requiredMatches
  );
}

/** Candidate-side denominator keeps a long instruction from diluting a hit. */
function candidateEvidenceCoverage(
  evidenceTokens: string[],
  positiveConcepts: ReadonlySet<string>,
): number {
  if (evidenceTokens.length === 0) {
    return 0;
  }
  const hits = evidenceTokens.filter((token) => positiveConcepts.has(token));
  return hits.length / Math.min(evidenceTokens.length, 12);
}

function canvasContextText(canvas: CanvasState): string {
  return [
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
  ].join(" ");
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
