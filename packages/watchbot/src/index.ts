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
  deriveProviderSearchQuery,
  type ProviderQueryTarget,
} from "./provider-query";
export {
  WATCHBOT_V0_SOURCE_TYPES,
  canonicalizeUrl,
  canonicalYouTubeWatchUrl,
  isBlockedWatchBotV0Host,
  isBlockedWatchBotV0Url,
  isWatchBotV0SourceType,
  normalizeDiscoveredItem,
  parsePublishedAt,
  sourceTypeToCardType,
  youtubeVideoIdFromWatchUrl,
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
export { mapBounded } from "./bounded-concurrency";
export {
  PASSTHROUGH_IMPORTANCE,
  PASSTHROUGH_MEANINGFULNESS_CLASSIFIER,
  PASSTHROUGH_MEANINGFULNESS_JUDGMENT,
  FAIL_CLOSED_MEANINGFULNESS_JUDGMENT,
  CLASSIFICATION_STATUSES,
  classifierStageDetail,
  createFixtureMeaningfulnessClassifier,
  failClosedMeaningfulnessJudgment,
  formatImportanceForDetail,
  isClassificationStatus,
  isMeaningfulDevelopment,
  JUDGE_DEFAULT_CONCURRENCY,
  judgeRepresentatives,
  normalizeImportanceScore,
  normalizeMeaningfulnessJudgment,
  selectMeaningfulDevelopments,
  toMeaningfulnessInput,
  type ClassificationStatus,
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
export {
  ClassifierCallBudget,
  classifierMaxCallsPerCycle,
  classifierMaxCallsPerWorkerTick,
  CLASSIFIER_MAX_CALLS_PER_CYCLE_CEILING,
  CLASSIFIER_MAX_CALLS_PER_CYCLE_DEFAULT,
  CLASSIFIER_MAX_CALLS_PER_TICK_CEILING,
  CLASSIFIER_MAX_CALLS_PER_TICK_DEFAULT,
} from "./classifier-budget";
export { FakeSourceProvider } from "./fake-provider";
export {
  createGrokSourceProvider,
  extractDiscoveredItems,
  grokEnvApiKey,
  type GrokSourceProviderOptions,
} from "./adapters/grok";
export {
  OPENAI_WEB_MODEL_DEFAULT,
  OPENAI_WEB_SOURCE_PROVIDER_LIMITS,
  buildDiscoveryPrompt,
  createOpenAIWebSourceProvider,
  openaiWebMaxRequestsPerCycle,
  openaiWebMaxRequestsPerTick,
  openaiWebMaxResultsPerCycle,
  openaiWebModel,
  openaiWebTimeoutMs,
  type OpenAIWebSourceProviderOptions,
} from "./adapters/openai-web";
export { isWebNewsSourceType } from "./adapters/web-news-items";
export {
  CLASSIFIER_TIMEOUT_MS_CEILING,
  CLASSIFIER_TIMEOUT_MS_DEFAULT,
  MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS,
  MEANINGFULNESS_JUDGMENT_JSON_SCHEMA,
  MEANINGFULNESS_JUDGMENT_TEXT_FORMAT,
  createModelMeaningfulnessClassifier,
  formatClassifierUserPayload,
  isMeaningfulnessClassifierEnabled,
  parseMeaningfulnessJudgment,
  classifierTimeoutMs,
  type ModelMeaningfulnessClassifierOptions,
} from "./adapters/meaningfulness-classifier";
export {
  createConfiguredMeaningfulnessClassifier,
  resolveMeaningfulnessProvider,
  type ConfiguredMeaningfulnessClassifierOptions,
  type MeaningfulnessProviderId,
} from "./adapters/meaningfulness-classifier-factory";
export {
  OPENAI_API_BASE_URL_DEFAULT,
  OPENAI_MEANINGFULNESS_MODEL_DEFAULT,
  createOpenAIMeaningfulnessClassifier,
  openaiEnvApiKey,
  openaiMeaningfulnessModel,
  type OpenAIMeaningfulnessClassifierOptions,
} from "./adapters/openai-meaningfulness-classifier";
export {
  createXSourceProvider,
  selectHighestBitrateMp4Variant,
  xBearerToken,
  X_SOURCE_PROVIDER_LIMITS,
  XSourceProviderError,
  type XSourceProviderErrorCode,
  type XSourceProviderOptions,
} from "./adapters/x";
export {
  YOUTUBE_SOURCE_PROVIDER_LIMITS,
  YouTubeSourceProviderError,
  canonicalYouTubeUrl,
  createYouTubeSourceProvider,
  youtubeApiKey,
  youtubeMaxRequestsPerTick,
  youtubeMaxResultsPerCycle,
  youtubeTimeoutMs,
  type YouTubeSourceProviderErrorCode,
  type YouTubeSourceProviderOptions,
  type YouTubeSourceProviderPublic,
} from "./adapters/youtube";
export {
  emptyMeaningfulnessClassifierTelemetry,
  noopWatchBotTelemetry,
  type EmitWatchBotTelemetry,
  type MeaningfulnessClassifierTelemetry,
  type WatchBotCostTelemetry,
} from "./telemetry";
