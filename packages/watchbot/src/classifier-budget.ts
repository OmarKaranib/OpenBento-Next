/**
 * Shared worker-tick / per-cycle budget for meaning-classifier HTTP calls.
 * Does not authorize a call by itself — the adapter still requires the
 * explicit env gate and credentials.
 */

export const CLASSIFIER_MAX_CALLS_PER_TICK_DEFAULT = 5;
export const CLASSIFIER_MAX_CALLS_PER_TICK_CEILING = 20;
export const CLASSIFIER_MAX_CALLS_PER_CYCLE_DEFAULT = 5;
export const CLASSIFIER_MAX_CALLS_PER_CYCLE_CEILING = 10;

function boundedInt(
  value: number | string | undefined,
  fallback: number,
  maximum: number,
  minimum = 0,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fallback;
  }
  return Math.min(parsed, maximum);
}

/** Shared worker-tick ceiling for actual classifier HTTP requests. */
export function classifierMaxCallsPerWorkerTick(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return boundedInt(
    env.WATCHBOT_MEANINGFULNESS_MAX_CALLS_PER_TICK,
    CLASSIFIER_MAX_CALLS_PER_TICK_DEFAULT,
    CLASSIFIER_MAX_CALLS_PER_TICK_CEILING,
    0,
  );
}

/** Per WatchBot pipeline cycle ceiling. Independent of the tick budget. */
export function classifierMaxCallsPerCycle(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return boundedInt(
    env.WATCHBOT_MEANINGFULNESS_MAX_CALLS_PER_CYCLE,
    CLASSIFIER_MAX_CALLS_PER_CYCLE_DEFAULT,
    CLASSIFIER_MAX_CALLS_PER_CYCLE_CEILING,
    0,
  );
}

/**
 * One object per worker tick. Call {@link ClassifierCallBudget.startCycle}
 * at the start of each WatchBot meaning stage so the cycle cap resets
 * while the tick cap keeps accumulating.
 */
export class ClassifierCallBudget {
  private tickUsed = 0;
  private cycleUsed = 0;

  constructor(
    private readonly tickLimit: number,
    private readonly cycleLimit: number,
  ) {}

  get calls(): number {
    return this.tickUsed;
  }

  get remainingTick(): number {
    return Math.max(0, this.tickLimit - this.tickUsed);
  }

  get remainingCycle(): number {
    return Math.max(0, this.cycleLimit - this.cycleUsed);
  }

  startCycle(): void {
    this.cycleUsed = 0;
  }

  isExhausted(): boolean {
    return this.tickUsed >= this.tickLimit || this.cycleUsed >= this.cycleLimit;
  }

  /** Returns false when the tick or current-cycle budget is exhausted. */
  tryConsume(): boolean {
    if (this.isExhausted()) {
      return false;
    }
    this.tickUsed += 1;
    this.cycleUsed += 1;
    return true;
  }
}
