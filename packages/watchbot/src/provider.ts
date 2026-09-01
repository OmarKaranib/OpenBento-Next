import type { WatchBotSourceType } from "@openbento/domain";
import type { XHttpBudget } from "./x-http-budget";

export interface DiscoveredItem {
  sourceUrl: string;
  title: string;
  publishedAt: string;
  sourceType: WatchBotSourceType;
  rawExcerpt?: string;
  author?: string;
  externalId?: string;
}

export interface SourceProviderDiscoverInput {
  canvasId: string;
  watchBotId: string;
  instruction: string;
  sourceTypes: WatchBotSourceType[];
  xHttpBudget?: XHttpBudget;
}

export interface SourceProvider {
  readonly id: string;
  readonly vendor: "xai-grok" | "x-api" | "unspecified";
  discover(input: SourceProviderDiscoverInput): Promise<DiscoveredItem[]>;
}
