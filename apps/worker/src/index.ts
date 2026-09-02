import { createWorkerDomainStore, type DomainStore } from "@openbento/domain";
import {
  createGrokSourceProvider,
  createXSourceProvider,
  FakeSourceProvider,
} from "@openbento/watchbot";
import { runWorkerCycle, type WorkerCycleResult } from "./cycle";
import { seedFixtureStore } from "./fixture";
import { createWorkerMonitoring, type WorkerMonitoring } from "./monitoring";
import {
  buildWorkerTickTelemetry,
  formatWorkerTickTelemetry,
  type WorkerRunMode,
} from "./telemetry";

export const WORKER_INTERVAL_MS_DEFAULT = 60_000;
export const WORKER_INTERVAL_MS_CEILING = 300_000;

export type WorkerMainOptions = {
  createStore?: () => DomainStore;
  runCycle?: typeof runWorkerCycle;
  abortSignal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  monitoring?: WorkerMonitoring;
};

/**
 * Fail closed. Absent / false / any value other than true or 1 means
 * the worker does not construct stores/providers or run cycles.
 */
export function isWorkerEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.OPENBENTO_WORKER_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * Env-gated one-shot. When true with worker enabled, runs exactly one tick
 * and exits even if argv includes --loop. Does not bypass worker/X gates.
 */
export function isWorkerRunOnce(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.OPENBENTO_WORKER_RUN_ONCE?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export function resolveRunOnce(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    isWorkerRunOnce(env) ||
    argv.includes("--once") ||
    !argv.includes("--loop")
  );
}

export function workerIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const parsed = Number(env.OPENBENTO_WORKER_INTERVAL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return WORKER_INTERVAL_MS_DEFAULT;
  }
  return Math.min(Math.floor(parsed), WORKER_INTERVAL_MS_CEILING);
}

function delay(ms: number, isStopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      clearInterval(check);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const check = setInterval(() => {
      if (isStopped()) {
        finish();
      }
    }, 20);
  });
}

/**
 * WatchBot worker entry. Runtime persist is `createWorkerDomainStore()`
 * (explicit service-role factory). It must not use web `getDomainStore()`,
 * which is user-JWT only. `--fixture` is isolated-test only.
 *
 * The global worker gate is evaluated before any provider or store. Provider
 * gates (including X_PROVIDER_ENABLED) are independent, narrower controls.
 */
export async function main(
  argv = process.argv.slice(2),
  options: WorkerMainOptions = {},
): Promise<void> {
  const env = options.env ?? process.env;
  const runOnce = resolveRunOnce(argv, env);
  const useGrok = argv.includes("--provider=grok");
  const useX = argv.includes("--provider=x");
  const useFixture = argv.includes("--fixture");
  const runMode: WorkerRunMode = runOnce ? "once" : "loop";

  let stopped = options.abortSignal?.aborted ?? false;
  const stop = () => {
    stopped = true;
  };

  if (!isWorkerEnabled(env)) {
    process.stdout.write("openbento_worker_disabled\n");
    return;
  }
  if (stopped) {
    return;
  }
  const monitoring = options.monitoring ?? createWorkerMonitoring(env);
  if (useGrok && useX) {
    throw new Error("Select only one WatchBot provider per worker process");
  }

  if (isWorkerRunOnce(env)) {
    process.stdout.write("openbento_worker_run_once\n");
  }

  if (!runOnce) {
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    options.abortSignal?.addEventListener("abort", stop, { once: true });
  }

  try {
    if (stopped) {
      return;
    }

    const grok = useGrok ? createGrokSourceProvider(undefined, env) : null;
    if (useGrok && !grok) {
      throw new Error("Grok adapter requested but XAI_API_KEY is unset");
    }
    const provider = useX ? createXSourceProvider(undefined, env) : grok ?? null;
    const seeded = useFixture ? await seedFixtureStore() : null;
    if (stopped) {
      return;
    }

    const createStore = options.createStore ?? createWorkerDomainStore;
    const store = seeded?.store ?? createStore();
    const selectedProvider =
      provider ?? seeded?.provider ?? new FakeSourceProvider([]);
    const runCycle = options.runCycle ?? runWorkerCycle;

    const tick = async (): Promise<WorkerCycleResult> => {
      const result = await runCycle({
        store,
        provider: selectedProvider,
        env,
      });
      const telemetry = buildWorkerTickTelemetry({
        provider: selectedProvider.id,
        result,
        runMode,
        includeWatchBots: true,
      });
      process.stdout.write(`${formatWorkerTickTelemetry(telemetry)}\n`);
      return result;
    };

    if (stopped) {
      return;
    }
    await tick();
    if (runOnce) {
      return;
    }

    const intervalMs = workerIntervalMs(env);
    while (!stopped && isWorkerEnabled(env)) {
      await delay(intervalMs, () => stopped);
      if (stopped || !isWorkerEnabled(env)) {
        break;
      }
      try {
        await tick();
      } catch (error) {
        monitoring.capture(error, "watchbot_tick");
        process.stderr.write("watchbot_tick_error\n");
      }
    }
  } catch (error) {
    monitoring.capture(error, "worker_main");
    await monitoring.flush();
    throw error;
  } finally {
    if (!runOnce) {
      process.off("SIGTERM", stop);
      process.off("SIGINT", stop);
      options.abortSignal?.removeEventListener("abort", stop);
    }
  }
}

if (process.argv.includes("--once") || process.argv.includes("--loop")) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "worker_error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
