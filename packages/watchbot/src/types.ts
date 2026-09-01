import type { WatchBot, WatchBotStatus } from "@openbento/domain";

export type { WatchBot, WatchBotStatus };

/** Runtime binding for a WatchBot on a Canvas. */
export interface WatchBotRuntimeBinding {
  watchBot: WatchBot;
  canvasId: string;
}

/**
 * Pipeline stages. Implementation lives in this package; the worker runs them.
 */
export const WATCHBOT_PIPELINE_STAGES = [
  "discover",
  "normalize",
  "dedup",
  "novelty",
  "relevance",
  "select",
  "provenance",
  "card",
] as const;

export type WatchBotPipelineStage = (typeof WATCHBOT_PIPELINE_STAGES)[number];
