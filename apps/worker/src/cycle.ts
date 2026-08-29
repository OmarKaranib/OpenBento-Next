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
 *
 * Pause / resume go through `pauseWatchBot` / `resumeWatchBot` (executor).
 * Those actions already cover running ↔ paused. There is no catalog action
 * for `error` + `lastError`, so only that failure path writes the WatchBot
 * row directly.
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
      await stampLastActivity(input.store, bot, now());
    } catch (error) {
      result.errors += 1;
      const message =
        error instanceof Error ? error.message.slice(0, 300) : "WatchBot error";
      await recordWatchBotError(input.store, bot, message, now());
    }
  }

  return result;
}

async function stampLastActivity(
  store: DomainStore,
  bot: WatchBot,
  timestamp: string,
): Promise<void> {
  const current = (await store.getWatchBot(bot.id)) ?? bot;
  if (current.status !== "running") {
    return;
  }
  await store.saveWatchBot({
    ...current,
    lastActivityAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * ACTION_CATALOG has pause/resume (running|paused) but no error action.
 * lastError is not an updateWatchBot field. This is the only store status write.
 */
async function recordWatchBotError(
  store: DomainStore,
  bot: WatchBot,
  lastError: string,
  timestamp: string,
): Promise<void> {
  const current = (await store.getWatchBot(bot.id)) ?? bot;
  await store.saveWatchBot({
    ...current,
    status: "error",
    lastError,
    lastActivityAt: timestamp,
    updatedAt: timestamp,
  });
}
