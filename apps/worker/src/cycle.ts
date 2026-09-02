import {
  createActionExecutor,
  type DomainStore,
  type WatchBot,
} from "@openbento/domain";
import {
  createConfiguredMeaningfulnessClassifier,
  isWatchBotProviderEligible,
  runWatchBotPipeline,
  XHttpBudget,
  xMaxRequestsPerWorkerTick,
  type MeaningfulnessClassifier,
  type PipelineCycleResult,
  type SourceProvider,
} from "@openbento/watchbot";

export interface WorkerCycleResult {
  watchBotsLoaded: number;
  watchBotsProcessed: number;
  providerEligibleWatchBots: number;
  processed: number;
  skippedPaused: number;
  skippedOther: number;
  cardsCreated: number;
  discovered: number;
  normalized: number;
  novel: number;
  duplicates: number;
  rejectedRelevance: number;
  errors: number;
  xHttpRequests: number;
  candidatesEligible: number;
  clustered: number;
  representatives: number;
  meaningful: number;
  notMeaningful: number;
  selected: number;
  classifierCalls: number;
  classifierMeaningful: number;
  classifierNotMeaningful: number;
  classifierErrors: number;
  classifierBudgetExhausted: number;
  classifierProvider?: string;
  classifierModel?: string;
  cycles: PipelineCycleResult[];
}

export interface RunWorkerCycleInput {
  store: DomainStore;
  provider: SourceProvider;
  now?: () => string;
  id?: () => string;
  env?: NodeJS.ProcessEnv;
  /**
   * Optional injected classifier (tests). Production composition uses
   * {@link createConfiguredMeaningfulnessClassifier} from env:
   * gate OFF, provider unset/`none`, or missing key for the selected
   * provider → passthrough. Never auto-picks OpenAI vs xAI from keys.
   */
  meaningfulnessClassifier?: MeaningfulnessClassifier | null;
}

const DEFAULT_SOURCE_TYPES = ["web", "news"] as const;

function classifierSafeIdentity(
  classifier: MeaningfulnessClassifier | null,
): Pick<WorkerCycleResult, "classifierProvider" | "classifierModel"> {
  if (!classifier || !("telemetry" in classifier)) {
    return {};
  }
  const telemetry = (
    classifier as {
      telemetry?: { classifierProvider?: string; classifierModel?: string };
    }
  ).telemetry;
  if (!telemetry || typeof telemetry !== "object") {
    return {};
  }
  return {
    ...(telemetry.classifierProvider
      ? { classifierProvider: telemetry.classifierProvider }
      : {}),
    ...(telemetry.classifierModel
      ? { classifierModel: telemetry.classifierModel }
      : {}),
  };
}

function resolveSourceTypes(bot: WatchBot): readonly string[] {
  return bot.sourceTypes.length > 0 ? bot.sourceTypes : DEFAULT_SOURCE_TYPES;
}

function aggregateCycleStats(
  result: WorkerCycleResult,
  cycle: PipelineCycleResult,
): void {
  result.discovered += cycle.stats.discovered;
  result.normalized += cycle.stats.normalized;
  result.novel += cycle.stats.novel;
  result.duplicates += cycle.stats.duplicates;
  result.rejectedRelevance += cycle.stats.rejectedRelevance;
  result.errors += cycle.stats.errors;
  result.candidatesEligible += cycle.stats.candidatesEligible;
  result.clustered += cycle.stats.clustered;
  result.representatives += cycle.stats.representatives;
  result.meaningful += cycle.stats.meaningful;
  result.notMeaningful += cycle.stats.notMeaningful;
  result.selected += cycle.stats.selected;
  result.classifierCalls += cycle.stats.classifierCalls;
  result.classifierMeaningful += cycle.stats.classifierMeaningful;
  result.classifierNotMeaningful += cycle.stats.classifierNotMeaningful;
  result.classifierErrors += cycle.stats.classifierErrors;
  result.classifierBudgetExhausted += cycle.stats.classifierBudgetExhausted;
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
  const env = input.env ?? process.env;
  const bots = await input.store.listWatchBots();
  const xHttpBudget =
    input.provider.vendor === "x-api"
      ? new XHttpBudget(xMaxRequestsPerWorkerTick(env))
      : undefined;
  const meaningfulnessClassifier =
    input.meaningfulnessClassifier === undefined
      ? createConfiguredMeaningfulnessClassifier(undefined, env)
      : input.meaningfulnessClassifier;

  const result: WorkerCycleResult = {
    watchBotsLoaded: bots.length,
    watchBotsProcessed: 0,
    providerEligibleWatchBots: 0,
    processed: 0,
    skippedPaused: 0,
    skippedOther: 0,
    cardsCreated: 0,
    discovered: 0,
    normalized: 0,
    novel: 0,
    duplicates: 0,
    rejectedRelevance: 0,
    errors: 0,
    xHttpRequests: 0,
    candidatesEligible: 0,
    clustered: 0,
    representatives: 0,
    meaningful: 0,
    notMeaningful: 0,
    selected: 0,
    classifierCalls: 0,
    classifierMeaningful: 0,
    classifierNotMeaningful: 0,
    classifierErrors: 0,
    classifierBudgetExhausted: 0,
    cycles: [],
    ...classifierSafeIdentity(meaningfulnessClassifier),
  };

  for (const bot of bots) {
    const sourceTypes = resolveSourceTypes(bot);

    if (bot.status === "paused") {
      result.skippedPaused += 1;
      continue;
    }
    if (bot.status !== "running") {
      result.skippedOther += 1;
      continue;
    }

    if (isWatchBotProviderEligible(input.provider, sourceTypes)) {
      result.providerEligibleWatchBots += 1;
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
        xHttpBudget,
        ...(meaningfulnessClassifier
          ? { meaningfulnessClassifier }
          : {}),
      });
      result.cycles.push(cycle);
      result.watchBotsProcessed += 1;
      result.processed += 1;
      result.cardsCreated += cycle.cardsCreated;
      aggregateCycleStats(result, cycle);
      if (!cycle.skipped) {
        await stampLastActivity(input.store, bot, now());
      }
    } catch (error) {
      result.errors += 1;
      const message =
        error instanceof Error ? error.message.slice(0, 300) : "WatchBot error";
      await recordWatchBotError(input.store, bot, message, now());
    }
  }

  result.xHttpRequests = xHttpBudget?.httpRequests ?? 0;
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
