/**
 * WatchBot Intelligence v1 — Slice A candidate selection.
 *
 * Ranking is provider-independent and multilingual-safe: only numeric
 * relevance + novelty scores plus arrival index. No language, script,
 * or English-verb features. A later stronger candidate outranks an
 * earlier weaker one. Exact ties are deterministic (earlier arrival).
 */

export const MAX_SELECTED_PER_CYCLE = 5;

export interface RankableCandidate {
  /** 0-based discovery order within this cycle. */
  arrivalIndex: number;
  relevanceScore: number;
  noveltyScore: number;
}

/**
 * Compare two eligible candidates. Higher relevance wins, then higher
 * novelty, then earlier arrival. Returns < 0 when `left` should rank first.
 */
export function compareCandidates(
  left: RankableCandidate,
  right: RankableCandidate,
): number {
  if (left.relevanceScore !== right.relevanceScore) {
    return right.relevanceScore - left.relevanceScore;
  }
  if (left.noveltyScore !== right.noveltyScore) {
    return right.noveltyScore - left.noveltyScore;
  }
  return left.arrivalIndex - right.arrivalIndex;
}

/**
 * Rank eligible candidates and keep at most `cap` (default
 * {@link MAX_SELECTED_PER_CYCLE}). Input order is discovery order;
 * output is rank order. Does not mutate `candidates`.
 */
export function selectCandidates<T extends RankableCandidate>(
  candidates: readonly T[],
  cap: number = MAX_SELECTED_PER_CYCLE,
): T[] {
  const limit = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0;
  if (limit === 0 || candidates.length === 0) {
    return [];
  }
  return [...candidates].sort(compareCandidates).slice(0, limit);
}
