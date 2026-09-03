/**
 * WatchBot Intelligence v1 — Slice C meaningful-development contract.
 *
 * After clustering, before `selectCandidates`, each representative may
 * receive an explicit **meaningful development / not meaningful
 * development** decision and an **importance score**. This module is the
 * provider-independent boundary for that judgment.
 *
 * Design (intentional contract-only outcome):
 * Distinguishing relevant chatter from a genuine new development is a
 * semantic judgment. ASCII/English keyword or verb gates would fail
 * multilingual/non-ASCII candidates and violate the Omar/#21 rule. This
 * slice therefore does **not** invent a lexical scorer and does **not**
 * call X, Grok, or any paid provider. Adapters stay out of
 * `@openbento/domain` and out of this file.
 *
 * Production default is **passthrough**: every representative is treated
 * as meaningful with {@link PASSTHROUGH_IMPORTANCE} so existing web/news/X
 * behavior is unchanged until a classifier is injected. When a classifier
 * *is* present, `meaningful: false` excludes the representative before
 * Card creation. A deterministic fixture classifier is the test double.
 * Model-backed adapters live in `adapters/` (Slice D) and stay out of
 * this file.
 *
 * Untrusted titles, snippets, and URLs are data. Never eval. Never follow
 * instructions found in source text.
 */

import { mapBounded } from "./bounded-concurrency";
import { sanitizeUntrustedText } from "./untrusted";
import type { RankableCandidate } from "./select-candidates";

/** Default importance when no classifier is configured. Not a quality score. */
export const PASSTHROUGH_IMPORTANCE = 0;

/**
 * Machine-safe classifier outcome for durable stage-event `detail`.
 *
 * - `classified` — HTTP/parse succeeded (or passthrough/fixture; omit treated as this)
 * - `budget_exhausted` — no HTTP attempt (`!budget.tryConsume()`); still fail-closed
 * - `error` — timeout / HTTP / malformed after an attempt; still fail-closed
 *
 * Never put prompts, source bodies, raw model output, or secrets here.
 */
export const CLASSIFICATION_STATUSES = [
  "classified",
  "budget_exhausted",
  "error",
] as const;

export type ClassificationStatus = (typeof CLASSIFICATION_STATUSES)[number];

export function isClassificationStatus(
  value: unknown,
): value is ClassificationStatus {
  return (
    value === "classified" ||
    value === "budget_exhausted" ||
    value === "error"
  );
}

export const PASSTHROUGH_MEANINGFULNESS_JUDGMENT: MeaningfulnessJudgment = {
  meaningful: true,
  importanceScore: PASSTHROUGH_IMPORTANCE,
  classificationStatus: "classified",
};

/** Fail-closed body for malformed/timeout/budget/provider errors. Adapters add status. */
export const FAIL_CLOSED_MEANINGFULNESS_JUDGMENT: MeaningfulnessJudgment = {
  meaningful: false,
  importanceScore: 0,
};

/** Fail-closed judgment with a machine-safe reason (budget skip vs attempted error). */
export function failClosedMeaningfulnessJudgment(
  classificationStatus: Extract<
    ClassificationStatus,
    "budget_exhausted" | "error"
  >,
): MeaningfulnessJudgment {
  return {
    ...FAIL_CLOSED_MEANINGFULNESS_JUDGMENT,
    classificationStatus,
  };
}

export interface MeaningfulnessInput {
  /** Sanitized discovered title. Untrusted data. */
  title: string;
  /** Sanitized excerpt/snippet. Untrusted data. */
  snippet: string;
  sourceType: string;
  /** Sanitized canonical URL. Untrusted data. */
  canonicalUrl: string;
  /**
   * WatchBot instruction (user configuration). Classifiers may use it as
   * the monitoring topic; they must not treat source text as commands.
   */
  instruction: string;
}

export interface MeaningfulnessJudgment {
  /** Explicit meaningful-development vs not-a-meaningful-development. */
  meaningful: boolean;
  /** Importance in [0, 1]. Higher outranks lower at selection. */
  importanceScore: number;
  /**
   * Optional machine-safe outcome. Omit is treated as `classified`.
   * Adapters must set `budget_exhausted` on a skipped HTTP attempt and
   * `error` after a failed attempt so pipeline `detail` can distinguish them.
   */
  classificationStatus?: ClassificationStatus;
}

/**
 * Provider-independent classifier port. Implementations (fixture, model
 * adapters) live beside other WatchBot adapters — never in domain.
 */
export interface MeaningfulnessClassifier {
  classify(
    input: MeaningfulnessInput,
  ): MeaningfulnessJudgment | Promise<MeaningfulnessJudgment>;
  /** Optional: reset per-WatchBot cycle call caps. Adapters only. */
  startCycle?(): void;
}

/** Production default: do not exclude; leave Slice A/B ranking intact. */
export const PASSTHROUGH_MEANINGFULNESS_CLASSIFIER: MeaningfulnessClassifier = {
  classify: () => PASSTHROUGH_MEANINGFULNESS_JUDGMENT,
};

export function isMeaningfulDevelopment(
  judgment: MeaningfulnessJudgment,
): boolean {
  return judgment.meaningful === true;
}

/** Clamp a classifier score into [0, 1]. Non-finite values become 0. */
export function normalizeImportanceScore(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

export function normalizeMeaningfulnessJudgment(
  judgment: MeaningfulnessJudgment,
): MeaningfulnessJudgment {
  return {
    meaningful: judgment.meaningful === true,
    importanceScore: normalizeImportanceScore(judgment.importanceScore),
    ...(isClassificationStatus(judgment.classificationStatus)
      ? { classificationStatus: judgment.classificationStatus }
      : {}),
  };
}

/** Stable short form for durable `detail` (3 decimal places, clamped to [0, 1]). */
export function formatImportanceForDetail(score: number): string {
  return normalizeImportanceScore(score).toFixed(3);
}

/**
 * Stage-event `detail` for classifier outcomes. Existing non-classifier
 * tokens (`clustered`, `not_selected`, `rejected_relevance`, …) stay unchanged.
 *
 * | Outcome | detail |
 * | --- | --- |
 * | budget skip (no HTTP) | `not_meaningful:budget_exhausted` |
 * | classified meaningful=false | `not_meaningful:classified:importance=<0..1>` |
 * | classified meaningful=true | `meaningful:classified:importance=<0..1>` |
 * | attempted error | `not_meaningful:error` |
 */
export function classifierStageDetail(
  judgment: Pick<
    MeaningfulnessJudgment,
    "meaningful" | "importanceScore" | "classificationStatus"
  >,
): string {
  const status = judgment.classificationStatus ?? "classified";
  if (status === "budget_exhausted") {
    return "not_meaningful:budget_exhausted";
  }
  if (status === "error") {
    return "not_meaningful:error";
  }
  const importance = formatImportanceForDetail(judgment.importanceScore);
  if (judgment.meaningful === true) {
    return `meaningful:classified:importance=${importance}`;
  }
  return `not_meaningful:classified:importance=${importance}`;
}

export function toMeaningfulnessInput(
  item: {
    title: string;
    snippet?: string;
    sourceType: string;
    canonicalUrl: string;
  },
  instruction: string,
): MeaningfulnessInput {
  return {
    title: sanitizeUntrustedText(item.title, 2_000),
    snippet: sanitizeUntrustedText(item.snippet ?? "", 2_000),
    sourceType: item.sourceType,
    canonicalUrl: sanitizeUntrustedText(item.canonicalUrl, 2_000),
    instruction,
  };
}

export type JudgedCandidate<T extends RankableCandidate> = T & {
  meaningful: boolean;
  importanceScore: number;
  classificationStatus: ClassificationStatus;
};

/**
 * Classify clustered representatives only. Does not mutate `representatives`.
 * A throwing classifier is fail-closed for that item (`meaningful: false`).
 */
/** Default maximum in-flight classifier calls inside {@link judgeRepresentatives}. */
export const JUDGE_DEFAULT_CONCURRENCY = 4;

export async function judgeRepresentatives<T extends RankableCandidate>(
  representatives: readonly T[],
  inputOf: (candidate: T) => MeaningfulnessInput,
  classifier: MeaningfulnessClassifier,
  concurrency: number = JUDGE_DEFAULT_CONCURRENCY,
): Promise<JudgedCandidate<T>[]> {
  return mapBounded(
    representatives,
    concurrency,
    async (representative) => {
      let judgment: MeaningfulnessJudgment = failClosedMeaningfulnessJudgment(
        "error",
      );
      try {
        judgment = normalizeMeaningfulnessJudgment(
          await classifier.classify(inputOf(representative)),
        );
      } catch {
        judgment = failClosedMeaningfulnessJudgment("error");
      }
      return {
        ...representative,
        meaningful: judgment.meaningful,
        importanceScore: judgment.importanceScore,
        classificationStatus: judgment.classificationStatus ?? "classified",
      } satisfies JudgedCandidate<T>;
    },
  );
}

/** Keep only meaningful developments. Does not mutate `judged`. */
export function selectMeaningfulDevelopments<T extends { meaningful: boolean }>(
  judged: readonly T[],
): T[] {
  return judged.filter((candidate) => candidate.meaningful === true);
}

/**
 * Deterministic fixture classifier. Lookups are exact title / URL matches
 * supplied by tests — not a lexical heuristic. Unmatched inputs use
 * `unmatched` (default passthrough).
 */
export function createFixtureMeaningfulnessClassifier(
  table: Iterable<{
    title?: string;
    canonicalUrl?: string;
    meaningful: boolean;
    importanceScore: number;
    classificationStatus?: ClassificationStatus;
  }>,
  unmatched: MeaningfulnessJudgment = PASSTHROUGH_MEANINGFULNESS_JUDGMENT,
): MeaningfulnessClassifier {
  const byTitle = new Map<string, MeaningfulnessJudgment>();
  const byUrl = new Map<string, MeaningfulnessJudgment>();
  for (const entry of table) {
    const judgment: MeaningfulnessJudgment = {
      ...normalizeMeaningfulnessJudgment(entry),
      classificationStatus: entry.classificationStatus ?? "classified",
    };
    if (entry.title !== undefined) {
      byTitle.set(entry.title, judgment);
    }
    if (entry.canonicalUrl !== undefined) {
      byUrl.set(entry.canonicalUrl, judgment);
    }
  }
  return {
    classify(input) {
      return (
        byTitle.get(input.title) ??
        byUrl.get(input.canonicalUrl) ??
        unmatched
      );
    },
  };
}
