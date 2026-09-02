export type {
  DiscoveredItem,
  SourceProvider,
  SourceProviderDiscoverInput,
} from "./provider";
export {
  WATCHBOT_PIPELINE_STAGES,
  type WatchBotPipelineStage,
  type WatchBotRuntimeBinding,
} from "./types";
export type { WatchBot, WatchBotStatus } from "./types";
export {
  WATCHBOT_V0_SOURCE_TYPES,
  canonicalizeUrl,
  isBlockedWatchBotV0Host,
  isBlockedWatchBotV0Url,
  isWatchBotV0SourceType,
  normalizeDiscoveredItem,
  parsePublishedAt,
  sourceTypeToCardType,
  type NormalizedItem,
  type WatchBotV0SourceType,
} from "./normalize";
export { buildDedupKey } from "./dedup";
export { NOVELTY_THRESHOLD, isNovelEnough, scoreNovelty } from "./novelty";
export {
  RELEVANCE_THRESHOLD,
  isRelevantEnough,
  scoreRelevance,
  type RelevanceContext,
} from "./relevance";
export {
  deriveRelevanceIntent,
  deriveXPositiveSearchTerms,
  relevanceLaneForSourceType,
  type DerivedRelevanceIntent,
  type RelevanceLane,
} from "./relevance-intent";
export {
  assertSourceCardPayload,
  computePipelineCycleStats,
  isWatchBotProviderEligible,
  runWatchBotPipeline,
  type PipelineCycleResult,
  type PipelineCycleStats,
  type PipelineItemResult,
  type RunWatchBotPipelineInput,
} from "./pipeline";
export {
  MAX_SELECTED_PER_CYCLE,
  compareCandidates,
  selectCandidates,
  type RankableCandidate,
} from "./select-candidates";
export {
  PASSTHROUGH_IMPORTANCE,
  PASSTHROUGH_MEANINGFULNESS_CLASSIFIER,
  PASSTHROUGH_MEANINGFULNESS_JUDGMENT,
  createFixtureMeaningfulnessClassifier,
  isMeaningfulDevelopment,
  judgeRepresentatives,
  normalizeImportanceScore,
  selectMeaningfulDevelopments,
  toMeaningfulnessInput,
  type JudgedCandidate,
  type MeaningfulnessClassifier,
  type MeaningfulnessInput,
  type MeaningfulnessJudgment,
} from "./meaningfulness";
export {
  SAME_STORY_EXACT_MIN_SHARED,
  SAME_STORY_JACCARD,
  SAME_STORY_MIN_SHARED,
  areSameStory,
  clusterCandidates,
  tokenizeForClustering,
  type ClusteredCandidates,
  type StoryCluster,
} from "./cluster-candidates";
export {
  XHttpBudget,
  xMaxRequestsPerWorkerTick,
  X_MAX_REQUESTS_PER_WORKER_TICK_CEILING,
  X_MAX_REQUESTS_PER_WORKER_TICK_DEFAULT,
} from "./x-http-budget";
export { FakeSourceProvider } from "./fake-provider";
export {
  createGrokSourceProvider,
  extractDiscoveredItems,
  grokEnvApiKey,
  type GrokSourceProviderOptions,
} from "./adapters/grok";
export {
  createXSourceProvider,
  xBearerToken,
  X_SOURCE_PROVIDER_LIMITS,
  XSourceProviderError,
  type XSourceProviderErrorCode,
  type XSourceProviderOptions,
} from "./adapters/x";
export {
  noopWatchBotTelemetry,
  type EmitWatchBotTelemetry,
  type WatchBotCostTelemetry,
} from "./telemetry";
