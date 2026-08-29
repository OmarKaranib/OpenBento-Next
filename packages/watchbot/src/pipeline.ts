import {
  DEFAULT_CARD_SIZE,
  DomainError,
  isDomainError,
  isValidCardPayload,
  selectSmallestContainingFrame,
  type ActionExecutor,
  type CardProvenance,
  type DomainStore,
  type SourceCardPayload,
  type WatchBot,
  type WatchBotEvent,
  type WatchBotEventKind,
} from "@openbento/domain";
import { buildDedupKey } from "./dedup";
import {
  asSourceType,
  normalizeDiscoveredItem,
  sourceTypeToCardType,
  type NormalizedItem,
} from "./normalize";
import { isNovelEnough, scoreNovelty } from "./novelty";
import type { DiscoveredItem, SourceProvider } from "./provider";
import { isRelevantEnough, scoreRelevance } from "./relevance";
import {
  noopWatchBotTelemetry,
  type EmitWatchBotTelemetry,
} from "./telemetry";

const SOURCE_CARD_SIZE = {
  width: Math.max(DEFAULT_CARD_SIZE.width, 280),
  height: Math.max(DEFAULT_CARD_SIZE.height, 180),
};

const MAX_CARDS_PER_CYCLE = 5;

export interface PipelineItemResult {
  kind: WatchBotEventKind;
  dedupKey: string;
  cardId?: string;
  noveltyScore?: number;
  detail?: string;
}

export interface PipelineCycleResult {
  watchBotId: string;
  skipped: boolean;
  skipReason?: "paused" | "not_running";
  items: PipelineItemResult[];
  cardsCreated: number;
  durationMs: number;
}

export interface RunWatchBotPipelineInput {
  watchBot: WatchBot;
  executor: ActionExecutor;
  store: DomainStore;
  provider: SourceProvider;
  now?: () => string;
  id?: () => string;
  emitTelemetry?: EmitWatchBotTelemetry;
}

function isNoteLikePayload(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "text" in payload &&
    !("provenance" in payload)
  );
}

function buildProvenance(
  item: NormalizedItem,
  watchBotId: string,
): CardProvenance {
  return {
    sourceUrl: item.canonicalUrl,
    title: item.title,
    publishedAt: item.publishedAt,
    sourceType: asSourceType(item.sourceType),
    discoveredAt: item.discoveredAt,
    watchBotId,
  };
}

function buildSourcePayload(
  item: NormalizedItem,
  watchBotId: string,
): SourceCardPayload {
  return { provenance: buildProvenance(item, watchBotId) };
}

function nextCardPosition(
  existingCount: number,
): { x: number; y: number } {
  const col = existingCount % 3;
  const row = Math.floor(existingCount / 3);
  return {
    x: 48 + col * (SOURCE_CARD_SIZE.width + 32),
    y: 48 + row * (SOURCE_CARD_SIZE.height + 32),
  };
}

export async function runWatchBotPipeline(
  input: RunWatchBotPipelineInput,
): Promise<PipelineCycleResult> {
  const started = Date.now();
  const now = input.now ?? (() => new Date().toISOString());
  const id = input.id ?? (() => crypto.randomUUID());
  const emit = input.emitTelemetry ?? noopWatchBotTelemetry;
  const { watchBot, executor, store, provider } = input;

  if (watchBot.status === "paused") {
    return {
      watchBotId: watchBot.id,
      skipped: true,
      skipReason: "paused",
      items: [],
      cardsCreated: 0,
      durationMs: Date.now() - started,
    };
  }
  if (watchBot.status !== "running") {
    return {
      watchBotId: watchBot.id,
      skipped: true,
      skipReason: "not_running",
      items: [],
      cardsCreated: 0,
      durationMs: Date.now() - started,
    };
  }

  const results: PipelineItemResult[] = [];
  let cardsCreated = 0;

  try {
    const discovered = await provider.discover({
      canvasId: watchBot.canvasId,
      watchBotId: watchBot.id,
      instruction: watchBot.instruction,
      sourceTypes: ["web", "news"],
    });

    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "discovered",
      sourceUrl: `watchbot://${watchBot.id}/cycle`,
      dedupKey: `cycle:${watchBot.id}:${now()}:${id()}`,
      discoveredAt: now(),
      detail: String(discovered.length),
    });

    for (const raw of discovered) {
      if (cardsCreated >= MAX_CARDS_PER_CYCLE) {
        break;
      }
      try {
        const itemResult = await processItem({
          raw,
          watchBot,
          executor,
          store,
          now,
          id,
        });
        results.push(itemResult);
        if (itemResult.kind === "card_created") {
          cardsCreated += 1;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "item_failed";
        await persistStageEvent(store, {
          id: id(),
          watchBotId: watchBot.id,
          canvasId: watchBot.canvasId,
          kind: "error",
          sourceUrl: `watchbot://${watchBot.id}/item`,
          dedupKey: `error-item:${watchBot.id}:${now()}:${id()}`,
          discoveredAt: now(),
          detail: message.slice(0, 200),
        });
        results.push({
          kind: "error",
          dedupKey: `error-item:${watchBot.id}`,
          detail: message,
        });
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WatchBot pipeline failed";
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "error",
      sourceUrl: `watchbot://${watchBot.id}/error`,
      dedupKey: `error:${watchBot.id}:${now()}:${id()}`,
      discoveredAt: now(),
      detail: message.slice(0, 200),
    });
    results.push({
      kind: "error",
      dedupKey: `error:${watchBot.id}`,
      detail: message,
    });
    throw error;
  } finally {
    emit({
      provider: provider.id,
      units: results.length,
      watchBotId: watchBot.id,
      durationMs: Date.now() - started,
    });
  }

  return {
    watchBotId: watchBot.id,
    skipped: false,
    items: results,
    cardsCreated,
    durationMs: Date.now() - started,
  };
}

async function processItem(input: {
  raw: DiscoveredItem;
  watchBot: WatchBot;
  executor: ActionExecutor;
  store: DomainStore;
  now: () => string;
  id: () => string;
}): Promise<PipelineItemResult> {
  const { raw, watchBot, executor, store, now, id } = input;
  const discoveredAt = now();
  const normalized = normalizeDiscoveredItem(raw, discoveredAt);
  if (!normalized) {
    return {
      kind: "error",
      dedupKey: `invalid:${sanitizeKeyPart(raw.sourceUrl)}`,
      detail: "not_v0_source_or_unusable",
    };
  }

  const dedupKey = buildDedupKey(normalized);
  await persistStageEvent(store, {
    id: id(),
    watchBotId: watchBot.id,
    canvasId: watchBot.canvasId,
    kind: "discovered",
    sourceUrl: normalized.canonicalUrl,
    dedupKey: stageDedupKey(dedupKey, "discovered", id()),
    discoveredAt,
    title: normalized.title,
    publishedAt: normalized.publishedAt,
    sourceType: asSourceType(normalized.sourceType),
  });
  await persistStageEvent(store, {
    id: id(),
    watchBotId: watchBot.id,
    canvasId: watchBot.canvasId,
    kind: "normalized",
    sourceUrl: normalized.canonicalUrl,
    dedupKey: stageDedupKey(dedupKey, "normalized", id()),
    discoveredAt,
    title: normalized.title,
    publishedAt: normalized.publishedAt,
    sourceType: asSourceType(normalized.sourceType),
  });

  const prior = await store.listWatchBotEventsByWatchBot(watchBot.id);
  if (prior.some((event) => event.dedupKey === dedupKey)) {
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "duplicate",
      sourceUrl: normalized.canonicalUrl,
      dedupKey: stageDedupKey(dedupKey, "duplicate", id()),
      discoveredAt: now(),
      title: normalized.title,
      publishedAt: normalized.publishedAt,
      sourceType: asSourceType(normalized.sourceType),
      detail: "unique (watchBotId, dedupKey) already claimed",
    });
    return { kind: "duplicate", dedupKey };
  }

  const noveltyScore = scoreNovelty(normalized, prior);
  if (!isNovelEnough(noveltyScore)) {
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "normalized",
      sourceUrl: normalized.canonicalUrl,
      dedupKey: stageDedupKey(dedupKey, "low_novelty", id()),
      noveltyScore,
      discoveredAt: now(),
      title: normalized.title,
      detail: "low_novelty",
    });
    return { kind: "normalized", dedupKey, noveltyScore, detail: "low_novelty" };
  }

  await persistStageEvent(store, {
    id: id(),
    watchBotId: watchBot.id,
    canvasId: watchBot.canvasId,
    kind: "novel",
    sourceUrl: normalized.canonicalUrl,
    dedupKey: stageDedupKey(dedupKey, "novel", id()),
    noveltyScore,
    discoveredAt: now(),
    title: normalized.title,
    publishedAt: normalized.publishedAt,
    sourceType: asSourceType(normalized.sourceType),
  });

  const canvas = await executor.getCanvasState({ canvasId: watchBot.canvasId });
  const relevance = scoreRelevance(normalized, watchBot.instruction, canvas);
  if (!isRelevantEnough(relevance)) {
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "rejected_relevance",
      sourceUrl: normalized.canonicalUrl,
      dedupKey: stageDedupKey(dedupKey, "rejected_relevance", id()),
      noveltyScore,
      discoveredAt: now(),
      title: normalized.title,
      detail: "rejected_relevance",
    });
    return {
      kind: "rejected_relevance",
      dedupKey,
      noveltyScore,
      detail: "rejected_relevance",
    };
  }

  const cardType = sourceTypeToCardType(normalized.sourceType);
  const payload = buildSourcePayload(normalized, watchBot.id);
  if (isNoteLikePayload(payload) || !isValidCardPayload(cardType, payload)) {
    await persistStageEvent(store, {
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "error",
      sourceUrl: normalized.canonicalUrl,
      dedupKey: stageDedupKey(dedupKey, "invalid_payload", id()),
      discoveredAt: now(),
      detail: "source_payload_invalid",
    });
    return {
      kind: "error",
      dedupKey,
      detail: "source_payload_invalid",
    };
  }

  const position = nextCardPosition(canvas.cards.length);
  const card = await executor.createCard({
    canvasId: watchBot.canvasId,
    type: cardType,
    payload,
    position,
    size: { ...SOURCE_CARD_SIZE },
  });

  const afterCreate = await executor.getCanvasState({
    canvasId: watchBot.canvasId,
  });
  const frameId = selectSmallestContainingFrame(
    {
      x: card.position.x,
      y: card.position.y,
      width: card.size.width,
      height: card.size.height,
    },
    afterCreate.frames,
  );
  await executor.setCardFrame({ cardId: card.id, frameId });

  /**
   * Unique claim is persisted last, only after createCard + setCardFrame.
   * A thrown createCard must not occupy the key and block a later retry.
   */
  try {
    await store.saveWatchBotEvent({
      id: id(),
      watchBotId: watchBot.id,
      canvasId: watchBot.canvasId,
      kind: "card_created",
      sourceUrl: normalized.canonicalUrl,
      dedupKey,
      noveltyScore,
      discoveredAt: now(),
      title: normalized.title,
      publishedAt: normalized.publishedAt,
      sourceType: asSourceType(normalized.sourceType),
      cardId: card.id,
    });
  } catch (error) {
    if (isDomainError(error) && error.code === "conflict") {
      await persistStageEvent(store, {
        id: id(),
        watchBotId: watchBot.id,
        canvasId: watchBot.canvasId,
        kind: "duplicate",
        sourceUrl: normalized.canonicalUrl,
        dedupKey: stageDedupKey(dedupKey, "duplicate", id()),
        discoveredAt: now(),
        title: normalized.title,
        detail: "unique (watchBotId, dedupKey) conflict",
      });
      return { kind: "duplicate", dedupKey, cardId: card.id };
    }
    throw error;
  }

  return {
    kind: "card_created",
    dedupKey,
    cardId: card.id,
    noveltyScore,
  };
}

function stageDedupKey(claimKey: string, stage: string, eventId: string): string {
  return `${claimKey}::${stage}::${eventId}`;
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/\s+/g, "").slice(0, 80) || "empty";
}

async function persistStageEvent(
  store: DomainStore,
  event: WatchBotEvent,
): Promise<void> {
  try {
    await store.saveWatchBotEvent(event);
  } catch (error) {
    if (isDomainError(error) && error.code === "conflict") {
      return;
    }
    if (error instanceof DomainError && error.code === "conflict") {
      return;
    }
    throw error;
  }
}

/** Exposed for tests: source Cards must carry provenance, never a note payload. */
export function assertSourceCardPayload(
  type: "web" | "news" | "article",
  payload: unknown,
): payload is SourceCardPayload {
  if (isNoteLikePayload(payload)) {
    return false;
  }
  return isValidCardPayload(type, payload);
}
