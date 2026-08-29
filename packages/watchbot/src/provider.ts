import type { WatchBotSourceType } from "@openbento/domain";

/**
 * Provider-agnostic discovery port.
 * First adapter (planned): xAI / Grok. Not imported by `@openbento/domain`.
 * Initial sources (master context): web/news, then X, then YouTube.
 */
export interface DiscoveredItem {
  sourceUrl: string;
  title: string;
  publishedAt: string;
  sourceType: WatchBotSourceType;
  rawExcerpt?: string;
}

export interface SourceProvider {
  readonly id: string;
  readonly vendor: "xai-grok" | "unspecified";
  discover(input: {
    canvasId: string;
    watchBotId: string;
    instruction: string;
    sourceTypes: WatchBotSourceType[];
  }): Promise<DiscoveredItem[]>;
}
