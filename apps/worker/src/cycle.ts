import {
  createActionExecutor,
  type DomainStore,
  type WatchBot,
} from "@openbento/domain";
import {
  runWatchBotPipeline,
  type PipelineCycleResult,
  type SourceProvider,
} from "@openbento/watchbot";

export interface WorkerCycleResult {
  processed: number;
  skippedPaused: number;
  skippedOther: number;
  cardsCreated: number;
  errors: number;
  cycles: PipelineCycleResult[];
}

export interface RunWorkerCycleInput {
  store: DomainStore;
  provider: SourceProvider;
  now?: () => string;
  id?: () => string;
}

/**
 * One worker tick: load WatchBots, skip paused, run the shared pipeline.
 * Unexpected failures set status `error` + lastError and do not crash the process.
 */
export async function runWorkerCycle(
  input: RunWorkerCycleInput,
): Promise<WorkerCycleResult> {
  const now = input.now ?? (() => new Date().toISOString());
  const bots = await input.store.listWatchBots();
  const result: WorkerCycleResult = {
    processed: 0,
    skippedPaused: 0,
    skippedOther: 0,
    cardsCreated: 0,
    errors: 0,
    cycles: [],
  };

  for (const bot of bots) {
    if (bot.status === "paused") {
      result.skippedPaused += 1;
      continue;
    }
    if (bot.status !== "running") {
      result.skippedOther += 1;
      continue;
    }

    const executor = createActionExecutor({
      store: input.store,
      ownerId: bot.ownerId,
      now,
      id: input.id,
    });

    try {
      const cycle = await runWatchBotPipeline({
        watchBot: bot,
        executor,
        store: input.store,
        provider: input.provider,
        now,
        id: input.id,
      });
      result.cycles.push(cycle);
      result.processed += 1;
      result.cardsCreated += cycle.cardsCreated;
      await touchWatchBot(input.store, bot, {
        lastActivityAt: now(),
        lastError: undefined,
        status: "running",
      });
    } catch (error) {
      result.errors += 1;
      const message =
        error instanceof Error ? error.message.slice(0, 300) : "WatchBot error";
      await touchWatchBot(input.store, bot, {
        status: "error",
        lastError: message,
        lastActivityAt: now(),
      });
    }
  }

  return result;
}

async function touchWatchBot(
  store: DomainStore,
  bot: WatchBot,
  patch: Partial<Pick<WatchBot, "status" | "lastError" | "lastActivityAt">>,
): Promise<void> {
  const current = (await store.getWatchBot(bot.id)) ?? bot;
  await store.saveWatchBot({
    ...current,
    ...patch,
    updatedAt: patch.lastActivityAt ?? current.updatedAt,
  });
}
