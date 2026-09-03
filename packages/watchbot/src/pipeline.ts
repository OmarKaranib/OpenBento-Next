import {
  DEFAULT_CARD_SIZE,
  DomainError,
  findFreeCardPosition,
  isDomainError,
  isValidCardPayload,
  selectSmallestContainingFrame,
  type ActionExecutor,
  type CardProvenance,
  type DomainStore,
  type Size,
  type SourceCardPayload,
  type WatchBot,
  type WatchBotEvent,
  type WatchBotEventKind,
} from "@openbento/domain";
import { clusterCandidates } from "./cluster-candidates";
import { buildDedupKey } from "./dedup";
import {
  PASSTHROUGH_MEANINGFULNESS_CLASSIFIER,
  classifierStageDetail,
  judgeRepresentatives,
  selectMeaningfulDevelopments,
  toMeaningfulnessInput,
  type MeaningfulnessClassifier,
} from "./meaningfulness";
import {
  asSourceType,
  normalizeDiscoveredItem,
  sourceTypeToCardType,
  type NormalizedItem,
} from "./normalize";
import { isNovelEnough, scoreNovelty } from "./novelty";
import type { DiscoveredItem, SourceProvider } from "./provider";
import { isRelevantEnough, scoreRelevance } from "./relevance";
import {
  MAX_SELECTED_PER_CYCLE,
  selectCandidates,
  type RankableCandidate,
} from "./select-candidates";
import {
  emptyMeaningfulnessClassifierTelemetry,
  noopWatchBotTelemetry,
  type EmitWatchBotTelemetry,
  type MeaningfulnessClassifierTelemetry,
} from "./telemetry";
import type { XHttpBudget } from "./x-http-budget";

const SOURCE_CARD_SIZE: Size = {
  width: Math.max(DEFAULT_CARD_SIZE.width, 280),
  height: Math.max(DEFAULT_CARD_SIZE.height, 180),
};

const DEFAULT_SOURCE_TYPES = ["web", "news"] as const;

export interface PipelineItemResult {
  kind: WatchBotEventKind;
  dedupKey: string;
  cardId?: string;
  noveltyScore?: number;
  detail?: string;
  /** Set when the item cleared the novelty threshold in this cycle. */
  passedNovelty?: boolean;
  /** Passed normalize/dedup/novelty/relevance and entered the selection pool. */
  candidateEligible?: boolean;
  /** Eligible but collapsed into another same-story representative. */
  clustered?: boolean;
  /** Representative excluded as not a meaningful development. */
  notMeaningful?: boolean;
  /** Slice C importance when this item was judged as a representative. */
  importanceScore?: number;
  /** Chosen by selectCandidates for Card creation in this cycle. */
  selected?: boolean;
}

export interface PipelineCycleStats {
  discovered: number;
  normalized: number;
  novel: number;
  duplicates: number;
  rejectedRelevance: number;
  errors: number;
  cardsCreated: number;
  candidatesEligible: number;
  clustered: number;
  representatives: number;
  meaningful: number;
  notMeaningful: number;
  selected: number;
  classifierCalls: number;
  classifierMeaningful: number;
  classifierNotMeaningful: number;
  classifierErrors: number;
  classifierBudgetExhausted: number;
}

export interface PipelineCycleResult {
  watchBotId: string;
  skipped: boolean;
  skipReason?:
    | "paused"
    | "not_running"
    | "provider_not_eligible"
    | "x_budget_exhausted";
  items: PipelineItemResult[];
  stats: PipelineCycleStats;
  topOutcome?: string;
  cardsCreated: number;
  durationMs: number;
}

export interface RunWatchBotPipelineInput {
  watchBot: WatchBot;
  executor: ActionExecutor;
  store: DomainStore;
  provider: SourceProvider;
  now?: () => string;
  id?: () => string;
  emitTelemetry?: EmitWatchBotTelemetry;
  xHttpBudget?: XHttpBudget;
  /**
   * Optional Slice C classifier. Default passthrough keeps current
   * web/news/X Card creation. When provided, `meaningful: false`
   * excludes that representative before Card creation.
   */
  meaningfulnessClassifier?: MeaningfulnessClassifier;
}

function isNoteLikePayload(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "text" in payload &&
    !("provenance" in payload)
  );
}

function buildProvenance(
  item: NormalizedItem,
  watchBotId: string,
): CardProvenance {
  return {
    sourceUrl: item.canonicalUrl,
    title: item.title,
    publishedAt: item.publishedAt,
    sourceType: asSourceType(item.sourceType),
    discoveredAt: item.discoveredAt,
    watchBotId,
    ...(item.author ? { author: item.author } : {}),
    ...(item.externalId ? { externalId: item.externalId } : {}),
  };
}

function buildSourcePayload(
  item: NormalizedItem,
  watchBotId: string,
): SourceCardPayload {
  return { provenance: buildProvenance(item, watchBotId) };
}

export function isWatchBotProviderEligible(
  provider: SourceProvider,
  sourceTypes: readonly string[],
): boolean {
  if (provider.vendor === "x-api") {
    return sourceTypes.includes("x");
  }
  if (provider.vendor === "youtube-api") {
    return sourceTypes.includes("youtube");
  }
  if (provider.vendor === "openai") {
    return sourceTypes.includes("web") || sourceTypes.includes("news");
  }
  return true;
}

export function computePipelineCycleStats(
  discoveredCount: number,
  items: PipelineItemResult[],
  cardsCreated: number,
  classifierTelemetry: MeaningfulnessClassifierTelemetry = emptyMeaningfulnessClassifierTelemetry(),
): PipelineCycleStats {
  let duplicates = 0;
  let rejectedRelevance = 0;
  let errors = 0;

  for (const item of items) {
    switch (item.kind) {
      case "duplicate":
        duplicates += 1;
        break;
      case "rejected_relevance":
        rejectedRelevance += 1;
        break;
      case "card_created":
        break;
      case "normalized":
        break;
      case "error":
        errors += 1;
        break;
      default:
        break;
    }
  }

  const normalizeErrors = items.filter(
    (item) =>
      item.kind === "error" && item.detail === "not_v0_source_or_unusable",
  ).length;
  const normalized = Math.max(0, discoveredCount - normalizeErrors);
  const novel = items.filter((item) => item.passedNovelty === true).length;
  const candidatesEligible = items.filter(
    (item) => item.candidateEligible === true,
  ).length;
  const clustered = items.filter((item) => item.clustered === true).length;
  const representatives = items.filter(
    (item) => item.candidateEligible === true && item.clustered !== true,
  ).length;
  const notMeaningful = items.filter((item) => item.notMeaningful === true).length;
  const meaningful = Math.max(0, representatives - notMeaningful);
  const selected = items.filter((item) => item.selected === true).length;

  return {
    discovered: discoveredCount,
    normalized,
    novel,
    duplicates,
    rejectedRelevance,
    errors,
    cardsCreated,
    candidatesEligible,
    clustered,
    representatives,
    meaningful,
    notMeaningful,
    selected,
    classifierCalls: classifierTelemetry.classifierCalls,
    classifierMeaningful: classifierTelemetry.classifierMeaningful,
    classifierNotMeaningful: classifierTelemetry.classifierNotMeaningful,
    classifierErrors: classifierTelemetry.classifierErrors,
    classifierBudgetExhausted: classifierTelemetry.classifierBudgetExhausted,
  };
}

function deriveTopOutcome(input: {
  skipped: boolean;
  skipReason?: PipelineCycleResult["skipReason"];
  stats: PipelineCycleStats;
}): string {
  if (input.skipped) {
    return input.skipReason ?? "skipped";
  }
  if (input.stats.errors > 0) {
    return "error";
  }
  if (input.stats.cardsCreated > 0) {
    return "card_created";
  }
  if (input.stats.rejectedRelevance > 0) {
    return "rejected_relevance";
  }
  if (input.stats.duplicates > 0) {
    return "duplicate";
  }
  if (input.stats.discovered === 0) {
    return "empty";
  }
  return "processed";
}

export async function runWatchBotPipeline(
  input: RunWatchBotPipelineInput,
): Promise<PipelineCycleResult> {
  const started = Date.now();
  const now = input.now ?? (() => new Date().toISOString());
  const id = input.id ?? (() => crypto.randomUUID());
  const emit = input.emitTelemetry ?? noopWatchBotTelemetry;
  const { watchBot, executor, store, provider } = input;
  const sourceTypes =
    watchBot.sourceTypes.length > 0
      ? watchBot.sourceTypes
      : [...DEFAULT_SOURCE_TYPES];

  if (watchBot.status === "paused") {
    const stats = emptyPipelineStats();
    return {
      watchBotId: watchBot.id,
      skipped: true,
      skipReason: "paused",
      items: [],
      stats,
      topOutcome: "paused",
      cardsCreated: 0,
      durationMs: Date.now() - started,
    };
  }
  if (watchBot.status !== "running") {
    const stats = emptyPipelineStats();
    return {
      watchBotId: watchBot.id,
      skipped: true,
      skipReason: "not_running",
      items: [],
      stats,
      topOutcome: "not_running",
      cardsCreated: 0,
      durationMs: Date.now() - started,
    };
  }

  if (!isWatchBotProviderEligible(provider, sourceTypes)) {
    const stats = emptyPipelineStats();
    return {
      watchBotId: watchBot.id,
      skipped: true,
      skipReason: "provider_not_eligible",
      items: [],
      stats,
      topOutcome: "provider_not_eligible",
      cardsCreated: 0,
      durationMs: Date.now() - started,
    };
  }

  if (
    provider.vendor === "x-api" &&
    sourceTypes.includes("x") &&
    input.xHttpBudget?.isExhausted()
  ) {
    const stats = emptyPipelineStats();
    return {
      watchBotId: watchBot.id,
      skipped: true,
      skipReason: "x_budget_exhausted",
      items: [],
      stats,
      topOutcome: "x_budget_exhausted",
      cardsCreated: 0,
      durationMs: Date.now() - started,
    };
  }

  const results: PipelineItemResult[] = [];
  let cardsCreated = 0;
  let discoveredCount = 0;
  let classifierTelemetry = emptyMeaningfulnessClassifierTelemetry();

  try {
    const providerResults = await provider.discover({
      canvasId: watchBot.canvasId,
      watchBotId: watchBot.id,
      instruction: watchBot.instruction,
      sourceTypes: [...sourceTypes],
      xHttpBudget: input.xHttpBudget,
    });
    const discovered = providerResults.filter((item) =>
      sourceTypes.includes(item.sourceType),
    );
    discoveredCount = discovered.length;

    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "discovered",
      sourceUrl: `watchbot://${watchBot.id}/cycle`,
      dedupKey: `cycle:${watchBot.id}:${now()}:${id()}`,
      discoveredAt: now(),
      detail: String(discovered.length),
    });

    const evaluations: ItemEvaluation[] = [];
    const seenEligibleKeys = new Set<string>();

    for (const [arrivalIndex, raw] of discovered.entries()) {
      try {
        evaluations.push(
          await evaluateItem({
            raw,
            arrivalIndex,
            watchBot,
            executor,
            store,
            now,
            id,
            seenEligibleKeys,
          }),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "item_failed";
        await persistStageEvent(store, {
          id: id(),
          watchBotId: watchBot.id,
          canvasId: watchBot.canvasId,
          kind: "error",
          sourceUrl: `watchbot://${watchBot.id}/item`,
          dedupKey: `error-item:${watchBot.id}:${now()}:${id()}`,
          discoveredAt: now(),
          detail: message.slice(0, 200),
        });
        evaluations.push({
          arrivalIndex,
          status: "rejected",
          result: {
            kind: "error",
            dedupKey: `error-item:${watchBot.id}`,
            detail: message,
          },
        });
      }
    }

    const eligible = evaluations.flatMap((evaluation) =>
      evaluation.status === "eligible" ? [evaluation.candidate] : [],
    );
    const clustered = clusterCandidates(
      eligible,
      (candidate) => candidate.normalized.title,
    );
    const classifier =
      input.meaningfulnessClassifier ?? PASSTHROUGH_MEANINGFULNESS_CLASSIFIER;
    classifier.startCycle?.();
    const telemetryBefore = snapshotClassifierTelemetry(classifier);
    const judged = await judgeRepresentatives(
      clustered.representatives,
      (candidate) =>
        toMeaningfulnessInput(candidate.normalized, watchBot.instruction),
      classifier,
    );
    classifierTelemetry = deltaClassifierTelemetry(
      telemetryBefore,
      snapshotClassifierTelemetry(classifier),
    );
    const meaningful = selectMeaningfulDevelopments(judged);
    const selected = selectCandidates(
      meaningful,
      MAX_SELECTED_PER_CYCLE,
    );
    const selectedKeys = new Set(selected.map((item) => item.dedupKey));
    const representativeKeys = new Set(
      clustered.representatives.map((item) => item.dedupKey),
    );
    const notMeaningfulKeys = new Set(
      judged.filter((item) => item.meaningful !== true).map((item) => item.dedupKey),
    );
    const importanceByKey = new Map(
      judged.map((item) => [item.dedupKey, item.importanceScore] as const),
    );
    const classificationStatusByKey = new Map(
      judged.map((item) => [item.dedupKey, item.classificationStatus] as const),
    );

    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "normalized",
      sourceUrl: `watchbot://${watchBot.id}/cycle-select`,
      dedupKey: `cycle-select:${watchBot.id}:${now()}:${id()}`,
      discoveredAt: now(),
      detail: `candidates_eligible=${eligible.length} clustered=${clustered.clusteredCount} representatives=${clustered.representatives.length} meaningful=${meaningful.length} not_meaningful=${notMeaningfulKeys.size} selected=${selected.length}`,
    });

    for (const evaluation of evaluations) {
      if (evaluation.status === "rejected") {
        results.push(evaluation.result);
        continue;
      }

      const { candidate } = evaluation;
      if (!selectedKeys.has(candidate.dedupKey)) {
        const clusteredOut = !representativeKeys.has(candidate.dedupKey);
        const notMeaningful = notMeaningfulKeys.has(candidate.dedupKey);
        const importanceScore = importanceByKey.get(candidate.dedupKey);
        const detail = clusteredOut
          ? "clustered"
          : notMeaningful
            ? classifierStageDetail({
                meaningful: false,
                importanceScore: importanceScore ?? 0,
                classificationStatus: classificationStatusByKey.get(
                  candidate.dedupKey,
                ),
              })
            : "not_selected";
        await persistStageEvent(store, {
          id: id(),
          watchBotId: watchBot.id,
          canvasId: watchBot.canvasId,
          kind: "normalized",
          sourceUrl: candidate.normalized.canonicalUrl,
          dedupKey: stageDedupKey(candidate.dedupKey, detail, id()),
          noveltyScore: candidate.noveltyScore,
          discoveredAt: now(),
          title: candidate.normalized.title,
          publishedAt: candidate.normalized.publishedAt,
          sourceType: asSourceType(candidate.normalized.sourceType),
          detail,
        });
        results.push({
          kind: "normalized",
          dedupKey: candidate.dedupKey,
          noveltyScore: candidate.noveltyScore,
          detail,
          passedNovelty: true,
          candidateEligible: true,
          ...(clusteredOut ? { clustered: true } : {}),
          ...(notMeaningful ? { notMeaningful: true } : {}),
          ...(importanceScore !== undefined ? { importanceScore } : {}),
        });
        continue;
      }

      try {
        const importanceScore = importanceByKey.get(candidate.dedupKey);
        const classifierDetail = classifierStageDetail({
          meaningful: true,
          importanceScore: importanceScore ?? 0,
          classificationStatus: classificationStatusByKey.get(candidate.dedupKey),
        });
        const itemResult = await createCardFromCandidate({
          candidate,
          watchBot,
          executor,
          store,
          now,
          id,
          classifierDetail,
        });
        results.push({
          ...itemResult,
          ...(importanceScore !== undefined ? { importanceScore } : {}),
        });
        if (itemResult.kind === "card_created") {
          cardsCreated += 1;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "item_failed";
        await persistStageEvent(store, {
          id: id(),
          watchBotId: watchBot.id,
          canvasId: watchBot.canvasId,
          kind: "error",
          sourceUrl: `watchbot://${watchBot.id}/item`,
          dedupKey: `error-item:${watchBot.id}:${now()}:${id()}`,
          discoveredAt: now(),
          detail: message.slice(0, 200),
        });
        const importanceScore = importanceByKey.get(candidate.dedupKey);
        results.push({
          kind: "error",
          dedupKey: candidate.dedupKey,
          noveltyScore: candidate.noveltyScore,
          detail: message,
          passedNovelty: true,
          candidateEligible: true,
          selected: true,
          ...(importanceScore !== undefined ? { importanceScore } : {}),
        });
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WatchBot pipeline failed";
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "error",
      sourceUrl: `watchbot://${watchBot.id}/error`,
      dedupKey: `error:${watchBot.id}:${now()}:${id()}`,
      discoveredAt: now(),
      detail: message.slice(0, 200),
    });
    results.push({
      kind: "error",
      dedupKey: `error:${watchBot.id}`,
      detail: message,
    });
    throw error;
  } finally {
    emit({
      provider: provider.id,
      units: results.length,
      watchBotId: watchBot.id,
      durationMs: Date.now() - started,
      classifierCalls: classifierTelemetry.classifierCalls,
      classifierMeaningful: classifierTelemetry.classifierMeaningful,
      classifierNotMeaningful: classifierTelemetry.classifierNotMeaningful,
      classifierErrors: classifierTelemetry.classifierErrors,
      classifierBudgetExhausted: classifierTelemetry.classifierBudgetExhausted,
      ...(classifierTelemetry.classifierProvider
        ? { classifierProvider: classifierTelemetry.classifierProvider }
        : {}),
      ...(classifierTelemetry.classifierModel
        ? { classifierModel: classifierTelemetry.classifierModel }
        : {}),
    });
  }

  const stats = computePipelineCycleStats(
    discoveredCount,
    results,
    cardsCreated,
    classifierTelemetry,
  );
  return {
    watchBotId: watchBot.id,
    skipped: false,
    items: results,
    stats,
    topOutcome: deriveTopOutcome({ skipped: false, stats }),
    cardsCreated,
    durationMs: Date.now() - started,
  };
}

function emptyPipelineStats(): PipelineCycleStats {
  return {
    discovered: 0,
    normalized: 0,
    novel: 0,
    duplicates: 0,
    rejectedRelevance: 0,
    errors: 0,
    cardsCreated: 0,
    candidatesEligible: 0,
    clustered: 0,
    representatives: 0,
    meaningful: 0,
    notMeaningful: 0,
    selected: 0,
    classifierCalls: 0,
    classifierMeaningful: 0,
    classifierNotMeaningful: 0,
    classifierErrors: 0,
    classifierBudgetExhausted: 0,
  };
}

function snapshotClassifierTelemetry(
  classifier: MeaningfulnessClassifier,
): MeaningfulnessClassifierTelemetry {
  if (!("telemetry" in classifier)) {
    return emptyMeaningfulnessClassifierTelemetry();
  }
  const telemetry = (classifier as { telemetry?: MeaningfulnessClassifierTelemetry })
    .telemetry;
  if (!telemetry || typeof telemetry !== "object") {
    return emptyMeaningfulnessClassifierTelemetry();
  }
  return {
    classifierCalls: telemetry.classifierCalls ?? 0,
    classifierMeaningful: telemetry.classifierMeaningful ?? 0,
    classifierNotMeaningful: telemetry.classifierNotMeaningful ?? 0,
    classifierErrors: telemetry.classifierErrors ?? 0,
    classifierBudgetExhausted: telemetry.classifierBudgetExhausted ?? 0,
    ...(telemetry.classifierProvider
      ? { classifierProvider: telemetry.classifierProvider }
      : {}),
    ...(telemetry.classifierModel
      ? { classifierModel: telemetry.classifierModel }
      : {}),
  };
}

function deltaClassifierTelemetry(
  before: MeaningfulnessClassifierTelemetry,
  after: MeaningfulnessClassifierTelemetry,
): MeaningfulnessClassifierTelemetry {
  return {
    classifierCalls: Math.max(0, after.classifierCalls - before.classifierCalls),
    classifierMeaningful: Math.max(
      0,
      after.classifierMeaningful - before.classifierMeaningful,
    ),
    classifierNotMeaningful: Math.max(
      0,
      after.classifierNotMeaningful - before.classifierNotMeaningful,
    ),
    classifierErrors: Math.max(0, after.classifierErrors - before.classifierErrors),
    classifierBudgetExhausted: Math.max(
      0,
      after.classifierBudgetExhausted - before.classifierBudgetExhausted,
    ),
    ...(after.classifierProvider
      ? { classifierProvider: after.classifierProvider }
      : {}),
    ...(after.classifierModel ? { classifierModel: after.classifierModel } : {}),
  };
}

interface EligibleCandidate extends RankableCandidate {
  dedupKey: string;
  normalized: NormalizedItem;
}

type ItemEvaluation =
  | { arrivalIndex: number; status: "rejected"; result: PipelineItemResult }
  | { arrivalIndex: number; status: "eligible"; candidate: EligibleCandidate };

async function evaluateItem(input: {
  raw: DiscoveredItem;
  arrivalIndex: number;
  watchBot: WatchBot;
  executor: ActionExecutor;
  store: DomainStore;
  now: () => string;
  id: () => string;
  seenEligibleKeys: Set<string>;
}): Promise<ItemEvaluation> {
  const { raw, arrivalIndex, watchBot, executor, store, now, id, seenEligibleKeys } =
    input;
  const discoveredAt = now();
  const normalized = normalizeDiscoveredItem(raw, discoveredAt);
  if (!normalized) {
    return {
      arrivalIndex,
      status: "rejected",
      result: {
        kind: "error",
        dedupKey: `invalid:${sanitizeKeyPart(raw.sourceUrl)}`,
        detail: "not_v0_source_or_unusable",
      },
    };
  }

  const dedupKey = buildDedupKey(normalized);
  await persistStageEvent(store, {
    id: id(),
    watchBotId: watchBot.id,
    canvasId: watchBot.canvasId,
    kind: "discovered",
    sourceUrl: normalized.canonicalUrl,
    dedupKey: stageDedupKey(dedupKey, "discovered", id()),
    discoveredAt,
    title: normalized.title,
    publishedAt: normalized.publishedAt,
    sourceType: asSourceType(normalized.sourceType),
  });
  await persistStageEvent(store, {
    id: id(),
    watchBotId: watchBot.id,
    canvasId: watchBot.canvasId,
    kind: "normalized",
    sourceUrl: normalized.canonicalUrl,
    dedupKey: stageDedupKey(dedupKey, "normalized", id()),
    discoveredAt,
    title: normalized.title,
    publishedAt: normalized.publishedAt,
    sourceType: asSourceType(normalized.sourceType),
  });

  const prior = await store.listWatchBotEventsByWatchBot(watchBot.id);
  if (
    prior.some((event) => event.dedupKey === dedupKey) ||
    seenEligibleKeys.has(dedupKey)
  ) {
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "duplicate",
      sourceUrl: normalized.canonicalUrl,
      dedupKey: stageDedupKey(dedupKey, "duplicate", id()),
      discoveredAt: now(),
      title: normalized.title,
      publishedAt: normalized.publishedAt,
      sourceType: asSourceType(normalized.sourceType),
      detail: "unique (watchBotId, dedupKey) already claimed",
    });
    return {
      arrivalIndex,
      status: "rejected",
      result: { kind: "duplicate", dedupKey },
    };
  }

  const noveltyScore = scoreNovelty(normalized, prior);
  if (!isNovelEnough(noveltyScore)) {
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "normalized",
      sourceUrl: normalized.canonicalUrl,
      dedupKey: stageDedupKey(dedupKey, "low_novelty", id()),
      noveltyScore,
      discoveredAt: now(),
      title: normalized.title,
      detail: "low_novelty",
    });
    return {
      arrivalIndex,
      status: "rejected",
      result: {
        kind: "normalized",
        dedupKey,
        noveltyScore,
        detail: "low_novelty",
      },
    };
  }

  await persistStageEvent(store, {
    id: id(),
    watchBotId: watchBot.id,
    canvasId: watchBot.canvasId,
    kind: "novel",
    sourceUrl: normalized.canonicalUrl,
    dedupKey: stageDedupKey(dedupKey, "novel", id()),
    noveltyScore,
    discoveredAt: now(),
    title: normalized.title,
    publishedAt: normalized.publishedAt,
    sourceType: asSourceType(normalized.sourceType),
  });

  const canvas = await executor.getCanvasState({ canvasId: watchBot.canvasId });
  const relevance = scoreRelevance(normalized, watchBot.instruction, canvas, {
    sourceType: normalized.sourceType,
  });
  if (!isRelevantEnough(relevance)) {
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "rejected_relevance",
      sourceUrl: normalized.canonicalUrl,
      dedupKey: stageDedupKey(dedupKey, "rejected_relevance", id()),
      noveltyScore,
      discoveredAt: now(),
      title: normalized.title,
      detail: "rejected_relevance",
    });
    return {
      arrivalIndex,
      status: "rejected",
      result: {
        kind: "rejected_relevance",
        dedupKey,
        noveltyScore,
        detail: "rejected_relevance",
        passedNovelty: true,
      },
    };
  }

  const cardType = sourceTypeToCardType(normalized.sourceType);
  const payload = buildSourcePayload(normalized, watchBot.id);
  if (isNoteLikePayload(payload) || !isValidCardPayload(cardType, payload)) {
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "error",
      sourceUrl: normalized.canonicalUrl,
      dedupKey: stageDedupKey(dedupKey, "invalid_payload", id()),
      discoveredAt: now(),
      detail: "source_payload_invalid",
    });
    return {
      arrivalIndex,
      status: "rejected",
      result: {
        kind: "error",
        dedupKey,
        detail: "source_payload_invalid",
        passedNovelty: true,
      },
    };
  }

  seenEligibleKeys.add(dedupKey);
  return {
    arrivalIndex,
    status: "eligible",
    candidate: {
      arrivalIndex,
      relevanceScore: relevance,
      noveltyScore,
      dedupKey,
      normalized,
    },
  };
}

async function createCardFromCandidate(input: {
  candidate: EligibleCandidate;
  watchBot: WatchBot;
  executor: ActionExecutor;
  store: DomainStore;
  now: () => string;
  id: () => string;
  classifierDetail?: string;
}): Promise<PipelineItemResult> {
  const { candidate, watchBot, executor, store, now, id, classifierDetail } =
    input;
  const { normalized, dedupKey, noveltyScore } = candidate;
  const canvas = await executor.getCanvasState({ canvasId: watchBot.canvasId });
  const cardType = sourceTypeToCardType(normalized.sourceType);
  const payload = buildSourcePayload(normalized, watchBot.id);
  const position = findFreeCardPosition(canvas.cards, SOURCE_CARD_SIZE);

  try {
    const card = await store.runInTransaction(async () => {
      const created = await executor.createCard({
        canvasId: watchBot.canvasId,
        type: cardType,
        payload,
        position,
        size: { ...SOURCE_CARD_SIZE },
      });
      const afterCreate = await executor.getCanvasState({
        canvasId: watchBot.canvasId,
      });
      const frameId = selectSmallestContainingFrame(
        {
          x: created.position.x,
          y: created.position.y,
          width: created.size.width,
          height: created.size.height,
        },
        afterCreate.frames,
      );
      await executor.setCardFrame({ cardId: created.id, frameId });
      await store.saveWatchBotEvent({
        id: id(),
        watchBotId: watchBot.id,
        canvasId: watchBot.canvasId,
        kind: "card_created",
        sourceUrl: normalized.canonicalUrl,
        dedupKey,
        noveltyScore,
        discoveredAt: now(),
        title: normalized.title,
        publishedAt: normalized.publishedAt,
        sourceType: asSourceType(normalized.sourceType),
        cardId: created.id,
        ...(classifierDetail ? { detail: classifierDetail } : {}),
      });
      return created;
    });

    return {
      kind: "card_created",
      dedupKey,
      cardId: card.id,
      noveltyScore,
      ...(classifierDetail ? { detail: classifierDetail } : {}),
      passedNovelty: true,
      candidateEligible: true,
      selected: true,
    };
  } catch (error) {
    if (isDomainError(error) && error.code === "conflict") {
      await persistStageEvent(store, {
        id: id(),
        watchBotId: watchBot.id,
        canvasId: watchBot.canvasId,
        kind: "duplicate",
        sourceUrl: normalized.canonicalUrl,
        dedupKey: stageDedupKey(dedupKey, "duplicate", id()),
        discoveredAt: now(),
        title: normalized.title,
        detail: "unique (watchBotId, dedupKey) conflict",
      });
      return { kind: "duplicate", dedupKey };
    }
    const message =
      error instanceof Error ? error.message.slice(0, 200) : "item_failed";
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "error",
      sourceUrl: `watchbot://${watchBot.id}/item`,
      dedupKey: `error-item:${watchBot.id}:${now()}:${id()}`,
      discoveredAt: now(),
      detail: message,
    });
    return {
      kind: "error",
      dedupKey,
      detail: message,
      passedNovelty: true,
      candidateEligible: true,
      selected: true,
    };
  }
}

function stageDedupKey(claimKey: string, stage: string, eventId: string): string {
  return `${claimKey}::${stage}::${eventId}`;
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/\s+/g, "").slice(0, 80) || "empty";
}

async function persistStageEvent(
  store: DomainStore,
  event: WatchBotEvent,
): Promise<void> {
  try {
    await store.saveWatchBotEvent(event);
  } catch (error) {
    if (isDomainError(error) && error.code === "conflict") {
      return;
    }
    if (error instanceof DomainError && error.code === "conflict") {
      return;
    }
    throw error;
  }
}

/** Exposed for tests: source Cards must carry provenance, never a note payload. */
export function assertSourceCardPayload(
  type: "web" | "news" | "article",
  payload: unknown,
): payload is SourceCardPayload {
  if (isNoteLikePayload(payload)) {
    return false;
  }
  return isValidCardPayload(type, payload);
}
