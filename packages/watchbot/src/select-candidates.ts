/**
 * WatchBot Intelligence v1 — Slice A/C candidate selection.
 *
 * Ranking is provider-independent and multilingual-safe: numeric scores
 * only. No language, script, or English-verb features.
 *
 * Comparator (descending unless noted):
 *   1. importanceScore (Slice C; missing/unscored treated as 0)
 *   2. relevanceScore
 *   3. noveltyScore
 *   4. arrivalIndex ascending (deterministic ties)
 *
 * Clustering runs before meaning, so representatives are still picked
 * with equal/absent importance and therefore Slice A order. After a
 * classifier assigns importance, high-importance developments outrank
 * low-importance ones. Passthrough production leaves all importance at
 * 0, so existing relevance → novelty → arrival ranking is unchanged.
 */

export const MAX_SELECTED_PER_CYCLE = 5;

export interface RankableCandidate {
  /** 0-based discovery order within this cycle. */
  arrivalIndex: number;
  relevanceScore: number;
  noveltyScore: number;
  /**
   * Slice C importance in [0, 1]. Absent means unscored / passthrough
   * and compares as 0.
   */
  importanceScore?: number;
}

function importanceOf(candidate: RankableCandidate): number {
  const score = candidate.importanceScore;
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

/**
 * Compare two candidates. Higher importance, then relevance, then
 * novelty, then earlier arrival. Returns < 0 when `left` ranks first.
 */
export function compareCandidates(
  left: RankableCandidate,
  right: RankableCandidate,
): number {
  const leftImportance = importanceOf(left);
  const rightImportance = importanceOf(right);
  if (leftImportance !== rightImportance) {
    return rightImportance - leftImportance;
  }
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
