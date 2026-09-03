import type { WatchBotSourceType } from "@openbento/domain";
import type { XHttpBudget } from "./x-http-budget";

/**
 * Provider-agnostic discovery port. Provider implementations stay in this
 * package and are never imported by `@openbento/domain`.
 */
export interface DiscoveredItem {
  sourceUrl: string;
  title: string;
  publishedAt: string;
  sourceType: WatchBotSourceType;
  rawExcerpt?: string;
  /** Optional source-supplied identity fields. Never inferred by the pipeline. */
  author?: string;
  externalId?: string;
}

export interface SourceProviderDiscoverInput {
  canvasId: string;
  watchBotId: string;
  instruction: string;
  sourceTypes: WatchBotSourceType[];
  /** Shared worker-tick budget for actual X HTTP requests. X adapter only. */
  xHttpBudget?: XHttpBudget;
}

export interface SourceProvider {
  readonly id: string;
  readonly vendor:
    | "xai-grok"
    | "x-api"
    | "youtube-api"
    | "openai"
    | "unspecified";
  discover(input: SourceProviderDiscoverInput): Promise<DiscoveredItem[]>;
  /**
   * Optional per-tick budget reset. Metered providers use this so a
   * process-long instance does not accumulate paid calls across worker ticks.
   */
  startWorkerTick?(): void;
}
