/**
 * Allowed WatchBot cost telemetry. Never include instruction, body, URL, or title.
 */
export interface WatchBotCostTelemetry {
  provider: string;
  units: number;
  watchBotId: string;
  durationMs: number;
}

export type EmitWatchBotTelemetry = (event: WatchBotCostTelemetry) => void;

export const noopWatchBotTelemetry: EmitWatchBotTelemetry = () => {
  /* docs-only taxonomy; no SDK in this slice */
};
