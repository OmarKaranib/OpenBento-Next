import type { WatchBotSourceType } from "@openbento/domain";

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

export interface SourceProvider {
  readonly id: string;
  readonly vendor: "xai-grok" | "x-api" | "unspecified";
  discover(input: {
    canvasId: string;
    watchBotId: string;
    instruction: string;
    sourceTypes: WatchBotSourceType[];
  }): Promise<DiscoveredItem[]>;
}
