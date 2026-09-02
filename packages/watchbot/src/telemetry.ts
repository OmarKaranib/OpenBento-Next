/**
 * Allowed WatchBot cost telemetry. Never include instruction, body, URL, or title.
 */
export interface WatchBotCostTelemetry {
  provider: string;
  units: number;
  watchBotId: string;
  durationMs: number;
  classifierCalls?: number;
  classifierMeaningful?: number;
  classifierNotMeaningful?: number;
  classifierErrors?: number;
  /** Budget skip with no HTTP attempt. Distinct from classifierErrors. */
  classifierBudgetExhausted?: number;
  /** Safe vendor id only (`openai` | `xai`). Never a key or payload. */
  classifierProvider?: string;
  /** Safe model id only (e.g. `gpt-5.6-luna`). Never a key or payload. */
  classifierModel?: string;
}

export interface MeaningfulnessClassifierTelemetry {
  classifierCalls: number;
  classifierMeaningful: number;
  classifierNotMeaningful: number;
  classifierErrors: number;
  classifierBudgetExhausted: number;
  classifierProvider?: string;
  classifierModel?: string;
}

export function emptyMeaningfulnessClassifierTelemetry(): MeaningfulnessClassifierTelemetry {
  return {
    classifierCalls: 0,
    classifierMeaningful: 0,
    classifierNotMeaningful: 0,
    classifierErrors: 0,
    classifierBudgetExhausted: 0,
  };
}

export type EmitWatchBotTelemetry = (event: WatchBotCostTelemetry) => void;

export const noopWatchBotTelemetry: EmitWatchBotTelemetry = () => {
  /* docs-only taxonomy; no SDK in this slice */
};
