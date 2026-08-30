import { createWorkerDomainStore } from "@openbento/domain";
import {
  createGrokSourceProvider,
  createXSourceProvider,
  FakeSourceProvider,
} from "@openbento/watchbot";
import { runWorkerCycle } from "./cycle";
import { seedFixtureStore } from "./fixture";

/**
 * WatchBot worker entry. Runtime persist is `createWorkerDomainStore()`
 * (explicit service-role factory). It must not use web `getDomainStore()`,
 * which is user-JWT only. `--fixture` is isolated-test only.
 *
 * Providers stay isolated in @openbento/watchbot. Default tests and
 * `--fixture` use the fake provider. `--provider=grok` and `--provider=x`
 * explicitly select their worker-only adapters; X remains disabled unless
 * X_PROVIDER_ENABLED=true.
 */
export async function main(argv = process.argv.slice(2)): Promise<void> {
  const once = argv.includes("--once") || !argv.includes("--loop");
  const useGrok = argv.includes("--provider=grok");
  const useX = argv.includes("--provider=x");
  const useFixture = argv.includes("--fixture");
  if (useGrok && useX) {
    throw new Error("Select only one WatchBot provider per worker process");
  }

  const grok = useGrok ? createGrokSourceProvider() : null;
  if (useGrok && !grok) {
    throw new Error("Grok adapter requested but XAI_API_KEY is unset");
  }
  const provider = useX
    ? createXSourceProvider()
    : grok ?? null;
  const seeded = useFixture ? await seedFixtureStore() : null;
  const store = seeded?.store ?? createWorkerDomainStore();
  const selectedProvider = provider ?? seeded?.provider ?? new FakeSourceProvider([]);

  const tick = async () => {
    const result = await runWorkerCycle({ store, provider: selectedProvider });
    const telemetry = {
      provider: selectedProvider.id,
      units: result.cardsCreated,
      watchBotIdCount: result.processed,
      durationMs: result.cycles.reduce((sum, cycle) => sum + cycle.durationMs, 0),
    };
    process.stdout.write(`${JSON.stringify(telemetry)}\n`);
    return result;
  };

  await tick();
  if (once) {
    return;
  }

  const intervalMs = Number(process.env.WATCHBOT_INTERVAL_MS ?? 60_000);
  setInterval(() => {
    void tick().catch(() => {
      process.stderr.write("watchbot_tick_error\n");
    });
  }, intervalMs);
}

if (process.argv.includes("--once") || process.argv.includes("--loop")) {
  void main();
}
