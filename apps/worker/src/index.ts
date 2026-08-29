import { createGrokSourceProvider } from "@openbento/watchbot";
import { runWorkerCycle } from "./cycle";
import { seedFixtureStore } from "./fixture";

/**
 * WatchBot worker entry. Default: one in-memory fixture cycle (no network, no secrets).
 * Optional Grok adapter is constructed only when XAI_API_KEY / GROK_API_KEY is set;
 * default tests and this CLI still use the fake provider unless --provider=grok.
 */
export async function main(argv = process.argv.slice(2)): Promise<void> {
  const once = argv.includes("--once") || !argv.includes("--loop");
  const useGrok = argv.includes("--provider=grok");
  const { store, provider: fake } = await seedFixtureStore();
  const grok = useGrok ? createGrokSourceProvider() : null;
  const provider = grok ?? fake;

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
