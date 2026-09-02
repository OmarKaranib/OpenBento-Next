/**
 * WatchBot Intelligence v1 — Slice B same-story clustering.
 *
 * Operates only on already-eligible candidates (after
 * normalize / exact dedup / novelty / relevance). Collapses
 * high-confidence paraphrases of one development before
 * `selectCandidates` so the per-cycle cap is spent on
 * representatives, not restatements.
 *
 * Provider-independent and multilingual-safe: Unicode NFKC
 * tokenization, no ASCII-only split, no English verb/stem list.
 * Conservative — prefer a missed paraphrase over merging
 * distinct developments. Representative is chosen with the
 * Slice A/C comparator. Importance is not assigned until after
 * clustering, so representative pick remains relevance → novelty →
 * arrivalIndex.
 * The representative object is unchanged (provenance stays
 * source-equivalent to that candidate).
 */

import {
  compareCandidates,
  type RankableCandidate,
} from "./select-candidates";
import { jaccardSimilarity, sanitizeUntrustedText } from "./untrusted";

/** Minimum Jaccard on Unicode title tokens to treat two items as one story. */
export const SAME_STORY_JACCARD = 0.72;

/** Paraphrase merge also requires this many shared tokens (except exact sets). */
export const SAME_STORY_MIN_SHARED = 3;

/** Exact token-set match may cluster with fewer tokens (identical short titles). */
export const SAME_STORY_EXACT_MIN_SHARED = 2;

/**
 * Scripts that do not use spaces between words. Those runs become
 * character bigrams so Japanese/Chinese/Thai paraphrases can match
 * without an English tokenizer.
 */
const UNSPACED_CHAR =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

export interface StoryCluster<T extends RankableCandidate> {
  representative: T;
  members: T[];
}

export interface ClusteredCandidates<T extends RankableCandidate> {
  /** One representative per cluster, in first-member discovery order. */
  representatives: T[];
  clusters: StoryCluster<T>[];
  /** Eligible items that are not representatives. */
  clusteredCount: number;
}

/**
 * Unicode-aware title tokens for clustering only. NFKC + lowercase.
 * Does not stem English verbs and does not drop non-ASCII letters.
 * Never executed, never parsed as code.
 */
type RunKind = "unspaced" | "word" | "number" | "other";

function runKind(char: string): RunKind {
  if (UNSPACED_CHAR.test(char)) {
    return "unspaced";
  }
  if (/\p{L}/u.test(char)) {
    return "word";
  }
  if (/\p{N}/u.test(char)) {
    return "number";
  }
  return "other";
}

function emitUnspacedRun(run: string, tokens: string[]): void {
  if (run.length === 1) {
    tokens.push(run);
    return;
  }
  for (let index = 0; index < run.length - 1; index += 1) {
    tokens.push(run.slice(index, index + 2));
  }
}

export function tokenizeForClustering(value: string): string[] {
  const cleaned = sanitizeUntrustedText(value, 2_000).normalize("NFKC").toLowerCase();
  const tokens: string[] = [];
  let run = "";
  let kind: RunKind = "other";

  const flush = (): void => {
    if (run.length === 0 || kind === "other") {
      run = "";
      kind = "other";
      return;
    }
    if (kind === "unspaced") {
      emitUnspacedRun(run, tokens);
    } else if (run.length >= 3) {
      tokens.push(run);
    } else if (kind === "number" && run.length >= 2) {
      tokens.push(run);
    }
    run = "";
    kind = "other";
  };

  for (const char of cleaned) {
    const next = runKind(char);
    if (next === "other") {
      flush();
      continue;
    }
    if (run.length === 0) {
      run = char;
      kind = next;
      continue;
    }
    if (next === kind) {
      run += char;
      continue;
    }
    flush();
    run = char;
    kind = next;
  }
  flush();
  return tokens;
}

export function uniqueTokens(tokens: readonly string[]): string[] {
  return [...new Set(tokens)];
}

/**
 * High-confidence same-development test. Empty tokenizations never match
 * (a non-ASCII title that tokenizes is not auto-rejected).
 */
export function areSameStory(leftTitle: string, rightTitle: string): boolean {
  const left = uniqueTokens(tokenizeForClustering(leftTitle));
  const right = uniqueTokens(tokenizeForClustering(rightTitle));
  if (left.length === 0 || right.length === 0) {
    return false;
  }
  const shared = sharedTokenCount(left, right);
  const jaccard = jaccardSimilarity(left, right);
  if (jaccard === 1 && shared >= SAME_STORY_EXACT_MIN_SHARED) {
    return true;
  }
  return jaccard >= SAME_STORY_JACCARD && shared >= SAME_STORY_MIN_SHARED;
}

/**
 * Cluster eligible candidates that are very likely the same development.
 * Single-linkage on `areSameStory` (any member), complete enough at 0.72
 * to keep materially distinct stories apart. Does not mutate `candidates`.
 */
export function clusterCandidates<T extends RankableCandidate>(
  candidates: readonly T[],
  titleOf: (candidate: T) => string,
): ClusteredCandidates<T> {
  const clusters: StoryCluster<T>[] = [];

  for (const candidate of candidates) {
    const title = titleOf(candidate);
    let assigned = false;
    for (const cluster of clusters) {
      if (
        cluster.members.some((member) => areSameStory(title, titleOf(member)))
      ) {
        cluster.members.push(candidate);
        if (compareCandidates(candidate, cluster.representative) < 0) {
          cluster.representative = candidate;
        }
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      clusters.push({ representative: candidate, members: [candidate] });
    }
  }

  const representatives = clusters.map((cluster) => cluster.representative);
  return {
    representatives,
    clusters,
    clusteredCount: Math.max(0, candidates.length - representatives.length),
  };
}

function sharedTokenCount(left: readonly string[], right: readonly string[]): number {
  const rightSet = new Set(right);
  let shared = 0;
  for (const token of new Set(left)) {
    if (rightSet.has(token)) {
      shared += 1;
    }
  }
  return shared;
}
