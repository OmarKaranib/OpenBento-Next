import type { WatchBot, WatchBotStatus } from "@openbento/domain";

export type { WatchBot, WatchBotStatus };

/** Runtime binding stub. No scheduler or actor loop in this package yet. */
export interface WatchBotRuntimeBinding {
  watchBot: WatchBot;
  canvasId: string;
}

/**
 * Planned pipeline stages. Implementation belongs in `apps/worker` after
 * the scaffold merges — not here.
 */
export const WATCHBOT_PIPELINE_STAGES = [
  "discover",
  "normalize",
  "dedup",
  "novelty",
  "relevance",
  "provenance",
  "card",
] as const;

export type WatchBotPipelineStage = (typeof WATCHBOT_PIPELINE_STAGES)[number];
