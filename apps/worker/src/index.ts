import { createWorkerDomainStore } from "@openbento/domain";
import { createGrokSourceProvider, FakeSourceProvider } from "@openbento/watchbot";
import { runWorkerCycle } from "./cycle";
import { seedFixtureStore } from "./fixture";

/**
 * WatchBot worker entry. Runtime persist is `createWorkerDomainStore()`
 * (explicit service-role factory). It must not use web `getDomainStore()`,
 * which is user-JWT only. `--fixture` is isolated-test only.
 *
 * Grok stays in the adapter. Default tests and `--fixture` use the fake
 * provider unless `--provider=grok`.
 */
export async function main(argv = process.argv.slice(2)): Promise<void> {
  const once = argv.includes("--once") || !argv.includes("--loop");
  const useGrok = argv.includes("--provider=grok");
  const useFixture = argv.includes("--fixture");

  const seeded = useFixture ? await seedFixtureStore() : null;
  const store = seeded?.store ?? createWorkerDomainStore();
  const grok = useGrok ? createGrokSourceProvider() : null;
  if (useGrok && !grok) {
    throw new Error("Grok adapter requested but XAI_API_KEY is unset");
  }
  const provider = grok ?? seeded?.provider ?? new FakeSourceProvider([]);

  const tick = async () => {
    const result = await runWorkerCycle({ store, provider });
    const telemetry = {
      provider: provider.id,
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
