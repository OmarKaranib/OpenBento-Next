export type { DiscoveredItem, SourceProvider } from "./provider";
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
  sourceTypeToCardType,
  type NormalizedItem,
  type WatchBotV0SourceType,
} from "./normalize";
export { buildDedupKey } from "./dedup";
export { NOVELTY_THRESHOLD, isNovelEnough, scoreNovelty } from "./novelty";
export { RELEVANCE_THRESHOLD, isRelevantEnough, scoreRelevance } from "./relevance";
export {
  assertSourceCardPayload,
  runWatchBotPipeline,
  type PipelineCycleResult,
  type PipelineItemResult,
  type RunWatchBotPipelineInput,
} from "./pipeline";
export { FakeSourceProvider } from "./fake-provider";
export {
  createGrokSourceProvider,
  extractDiscoveredItems,
  grokEnvApiKey,
  type GrokSourceProviderOptions,
} from "./adapters/grok";
export {
  noopWatchBotTelemetry,
  type EmitWatchBotTelemetry,
  type WatchBotCostTelemetry,
} from "./telemetry";
