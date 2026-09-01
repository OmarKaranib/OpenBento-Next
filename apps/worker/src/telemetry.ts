import type { WorkerCycleResult } from "./cycle";

export type WorkerRunMode = "once" | "loop";

export interface WorkerTickTelemetry {
  provider: string;
  watchBotsLoaded: number;
  watchBotsProcessed: number;
  providerEligibleWatchBots: number;
  cardsCreated: number;
  discovered: number;
  normalized: number;
  novel: number;
  duplicates: number;
  rejectedRelevance: number;
  errors: number;
  xHttpRequests: number;
  durationMs: number;
  runMode: WorkerRunMode;
  watchBots?: WorkerWatchBotTelemetry[];
}

export interface WorkerWatchBotTelemetry {
  watchBotId: string;
  discovered: number;
  cardsCreated: number;
  topOutcome: string;
}

const FORBIDDEN_TELEMETRY_SUBSTRINGS = [
  "bearer",
  "service_role",
  "service-role",
  "instruction",
  "ownerid",
  "owner_id",
  "x_bearer_token",
  "supabase_service_role_key",
] as const;

export function buildWorkerTickTelemetry(input: {
  provider: string;
  result: WorkerCycleResult;
  runMode: WorkerRunMode;
  includeWatchBots?: boolean;
}): WorkerTickTelemetry {
  const durationMs = input.result.cycles.reduce(
    (sum, cycle) => sum + cycle.durationMs,
    0,
  );
  const telemetry: WorkerTickTelemetry = {
    provider: input.provider,
    watchBotsLoaded: input.result.watchBotsLoaded,
    watchBotsProcessed: input.result.processed,
    providerEligibleWatchBots: input.result.providerEligibleWatchBots,
    cardsCreated: input.result.cardsCreated,
    discovered: input.result.discovered,
    normalized: input.result.normalized,
    novel: input.result.novel,
    duplicates: input.result.duplicates,
    rejectedRelevance: input.result.rejectedRelevance,
    errors: input.result.errors,
    xHttpRequests: input.result.xHttpRequests,
    durationMs,
    runMode: input.runMode,
  };

  if (input.includeWatchBots) {
    telemetry.watchBots = input.result.cycles.map((cycle) => ({
      watchBotId: cycle.watchBotId,
      discovered: cycle.stats.discovered,
      cardsCreated: cycle.stats.cardsCreated,
      topOutcome: cycle.topOutcome ?? (cycle.skipped ? cycle.skipReason ?? "skipped" : "none"),
    }));
  }

  return telemetry;
}

export function assertSafeWorkerTelemetry(
  telemetry: WorkerTickTelemetry,
): void {
  const serialized = JSON.stringify(telemetry).toLowerCase();
  for (const forbidden of FORBIDDEN_TELEMETRY_SUBSTRINGS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`unsafe telemetry field: ${forbidden}`);
    }
  }
}

export function formatWorkerTickTelemetry(
  telemetry: WorkerTickTelemetry,
): string {
  assertSafeWorkerTelemetry(telemetry);
  return JSON.stringify(telemetry);
}
