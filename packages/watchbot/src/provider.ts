import type { FirstSliceSourceType } from "@openbento/domain";

/**
 * Provider-agnostic discovery port.
 *
 * First adapter (planned): xAI / Grok. It must not be imported by
 * `@openbento/domain`. Domain stays vendor-free.
 *
 * First slice: web + news only. YouTube and X are later.
 */
export interface DiscoveredItem {
  sourceUrl: string;
  title: string;
  publishedAt: string;
  sourceType: FirstSliceSourceType;
  rawExcerpt?: string;
}

export interface SourceProvider {
  readonly id: string;
  readonly vendor: "xai-grok" | "unspecified";
  discover(input: {
    canvasId: string;
    watchBotId: string;
    sourceTypes: FirstSliceSourceType[];
  }): Promise<DiscoveredItem[]>;
}
