export const X_MAX_REQUESTS_PER_WORKER_TICK_DEFAULT = 1;
export const X_MAX_REQUESTS_PER_WORKER_TICK_CEILING = 10;

function boundedInt(value: number | string | undefined, fallback: number, maximum: number, minimum = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) return fallback;
  return Math.min(parsed, maximum);
}

export function xMaxRequestsPerWorkerTick(env: NodeJS.ProcessEnv = process.env): number {
  return boundedInt(env.X_MAX_REQUESTS_PER_WORKER_TICK, X_MAX_REQUESTS_PER_WORKER_TICK_DEFAULT, X_MAX_REQUESTS_PER_WORKER_TICK_CEILING, 0);
}

export class XHttpBudget {
  private used = 0;
  constructor(private readonly limit: number) {}
  get httpRequests(): number { return this.used; }
  get remaining(): number { return Math.max(0, this.limit - this.used); }
  isExhausted(): boolean { return this.used >= this.limit; }
  tryConsume(): boolean {
    if (this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }
}
