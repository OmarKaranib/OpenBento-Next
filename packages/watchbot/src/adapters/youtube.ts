import type {
  DiscoveredItem,
  SourceProvider,
  SourceProviderDiscoverInput,
} from "../provider";
import { sanitizeUntrustedText } from "../untrusted";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export const YOUTUBE_SOURCE_PROVIDER_LIMITS = {
  maxQueryLength: 400,
  maxRequestsPerCycle: 2,
  maxRequestsPerTick: 10,
  maxResultsPerCycle: 20,
  timeoutMs: 15_000,
  recentWindowDays: 30,
} as const;

const DEFAULTS = {
  maxRequestsPerTick: 2,
  maxResultsPerCycle: 10,
  timeoutMs: 10_000,
} as const;

export type YouTubeSourceProviderErrorCode =
  | "credential_missing"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "timeout"
  | "network"
  | "transient_server"
  | "malformed_response"
  | "invalid_query";

/** Classified, sanitized failure. The adapter never retries automatically. */
export class YouTubeSourceProviderError extends Error {
  readonly code: YouTubeSourceProviderErrorCode;
  readonly retryable: boolean;

  constructor(
    code: YouTubeSourceProviderErrorCode,
    message: string,
    options?: { retryable?: boolean },
  ) {
    super(message);
    this.name = "YouTubeSourceProviderError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}

export interface YouTubeSourceProviderOptions {
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRequestsPerTick?: number;
  maxResultsPerCycle?: number;
  timeoutMs?: number;
  now?: () => number;
}

export interface YouTubeSourceProviderPublic {
  readonly vendor: "youtube-api";
  readonly httpRequests: number;
  startWorkerTick(): void;
}

type ResolvedOptions = {
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  fetchImpl: typeof fetch;
  maxRequestsPerTick: number;
  maxResultsPerCycle: number;
  timeoutMs: number;
  now: () => number;
};

function boundedInt(
  value: number | string | undefined,
  fallback: number,
  maximum: number,
  minimum: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fallback;
  }
  return Math.min(parsed, maximum);
}

function youtubeProviderEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.YOUTUBE_PROVIDER_ENABLED === "true";
}

export function youtubeApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const key = env.YOUTUBE_API_KEY?.trim();
  return key ? key : undefined;
}

export function youtubeMaxRequestsPerTick(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return boundedInt(
    env.YOUTUBE_MAX_REQUESTS_PER_TICK,
    DEFAULTS.maxRequestsPerTick,
    YOUTUBE_SOURCE_PROVIDER_LIMITS.maxRequestsPerTick,
    0,
  );
}

export function youtubeMaxResultsPerCycle(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return boundedInt(
    env.YOUTUBE_MAX_RESULTS_PER_CYCLE,
    DEFAULTS.maxResultsPerCycle,
    YOUTUBE_SOURCE_PROVIDER_LIMITS.maxResultsPerCycle,
    1,
  );
}

export function youtubeTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return boundedInt(
    env.YOUTUBE_TIMEOUT_MS,
    DEFAULTS.timeoutMs,
    YOUTUBE_SOURCE_PROVIDER_LIMITS.timeoutMs,
    100,
  );
}

function resolveOptions(
  options: Partial<YouTubeSourceProviderOptions>,
  env: NodeJS.ProcessEnv,
): ResolvedOptions {
  return {
    enabled: options.enabled ?? youtubeProviderEnabled(env),
    apiKey: options.apiKey ?? youtubeApiKey(env),
    baseUrl: options.baseUrl ?? YOUTUBE_SEARCH_URL,
    fetchImpl: options.fetchImpl ?? fetch,
    maxRequestsPerTick: boundedInt(
      options.maxRequestsPerTick ?? env.YOUTUBE_MAX_REQUESTS_PER_TICK,
      DEFAULTS.maxRequestsPerTick,
      YOUTUBE_SOURCE_PROVIDER_LIMITS.maxRequestsPerTick,
      0,
    ),
    maxResultsPerCycle: boundedInt(
      options.maxResultsPerCycle ?? env.YOUTUBE_MAX_RESULTS_PER_CYCLE,
      DEFAULTS.maxResultsPerCycle,
      YOUTUBE_SOURCE_PROVIDER_LIMITS.maxResultsPerCycle,
      1,
    ),
    timeoutMs: boundedInt(
      options.timeoutMs ?? env.YOUTUBE_TIMEOUT_MS,
      DEFAULTS.timeoutMs,
      YOUTUBE_SOURCE_PROVIDER_LIMITS.timeoutMs,
      100,
    ),
    now: options.now ?? Date.now,
  };
}

/**
 * Official YouTube Data API v3 search adapter. Disabled by default and
 * read-only. Search results still pass through the existing WatchBot pipeline.
 */
export function createYouTubeSourceProvider(
  options: Partial<YouTubeSourceProviderOptions> = {},
  env: NodeJS.ProcessEnv = process.env,
): SourceProvider & YouTubeSourceProviderPublic {
  const resolved = resolveOptions(options, env);
  if (resolved.enabled && !resolved.apiKey) {
    throw new YouTubeSourceProviderError(
      "credential_missing",
      "YouTube provider is enabled but YOUTUBE_API_KEY is not configured.",
    );
  }
  return new YouTubeSourceProvider(resolved);
}

class YouTubeSourceProvider
  implements SourceProvider, YouTubeSourceProviderPublic
{
  readonly id = "youtube-data-api-v3";
  readonly vendor = "youtube-api" as const;
  private tickUsed = 0;

  constructor(private readonly options: ResolvedOptions) {}

  get httpRequests(): number {
    return this.tickUsed;
  }

  startWorkerTick(): void {
    this.tickUsed = 0;
  }

  async discover(input: SourceProviderDiscoverInput): Promise<DiscoveredItem[]> {
    if (!this.options.enabled || !input.sourceTypes.includes("youtube")) {
      return [];
    }
    if (!this.options.apiKey) {
      throw new YouTubeSourceProviderError(
        "credential_missing",
        "YouTube provider is not configured.",
      );
    }

    const query = sanitizeUntrustedText(
      input.instruction,
      YOUTUBE_SOURCE_PROVIDER_LIMITS.maxQueryLength,
    );
    if (!query) {
      throw new YouTubeSourceProviderError(
        "invalid_query",
        "YouTube provider requires a non-empty monitoring instruction.",
      );
    }

    const live = await this.search(query, "live");
    if (live.length > 0) {
      return live.slice(0, this.options.maxResultsPerCycle);
    }

    return (await this.search(query, "recent")).slice(
      0,
      this.options.maxResultsPerCycle,
    );
  }

  private async search(
    query: string,
    mode: "live" | "recent",
  ): Promise<DiscoveredItem[]> {
    if (this.tickUsed >= this.options.maxRequestsPerTick) {
      return [];
    }
    this.tickUsed += 1;

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: String(this.options.maxResultsPerCycle),
      videoEmbeddable: "true",
      videoSyndicated: "true",
      safeSearch: "strict",
      key: this.options.apiKey ?? "",
    });
    if (mode === "live") {
      params.set("eventType", "live");
    } else {
      params.set("publishedAfter", this.recentPublishedAfter());
    }

    const separator = this.options.baseUrl.includes("?") ? "&" : "?";
    const response = await fetchWithTimeout(
      this.options.fetchImpl,
      `${this.options.baseUrl}${separator}${params.toString()}`,
      { headers: { accept: "application/json" } },
      this.options.timeoutMs,
    );
    if (!response.ok) {
      throw httpError(response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new YouTubeSourceProviderError(
        "malformed_response",
        "YouTube provider returned an unreadable response.",
      );
    }
    return parseSearchResponse(body, this.options.maxResultsPerCycle);
  }

  private recentPublishedAfter(): string {
    const windowMs =
      YOUTUBE_SOURCE_PROVIDER_LIMITS.recentWindowDays * 24 * 60 * 60 * 1_000;
    return new Date(this.options.now() - windowMs).toISOString();
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    if (controller.signal.aborted) {
      throw new YouTubeSourceProviderError(
        "timeout",
        "YouTube provider request timed out.",
        { retryable: true },
      );
    }
    throw new YouTubeSourceProviderError(
      "network",
      "YouTube provider request could not be completed.",
      { retryable: true },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function httpError(status: number): YouTubeSourceProviderError {
  if (status === 401) {
    return new YouTubeSourceProviderError(
      "unauthorized",
      "YouTube provider rejected credentials.",
    );
  }
  if (status === 403) {
    return new YouTubeSourceProviderError(
      "forbidden",
      "YouTube provider access is forbidden.",
    );
  }
  if (status === 429) {
    return new YouTubeSourceProviderError(
      "rate_limited",
      "YouTube provider rate limit reached.",
      { retryable: true },
    );
  }
  if (status >= 500 && status <= 599) {
    return new YouTubeSourceProviderError(
      "transient_server",
      "YouTube provider is temporarily unavailable.",
      { retryable: true },
    );
  }
  return new YouTubeSourceProviderError(
    "malformed_response",
    "YouTube provider rejected the search request.",
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sanitizedMetadata(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  const withoutMarkup = value.replace(/<[^>]*>/g, " ").replace(/[<>]/g, " ");
  return sanitizeUntrustedText(withoutMarkup, maxLength);
}

function parseSearchResponse(body: unknown, limit: number): DiscoveredItem[] {
  const record = asRecord(body);
  if (!record || !Array.isArray(record.items)) {
    throw new YouTubeSourceProviderError(
      "malformed_response",
      "YouTube provider response did not contain an items array.",
    );
  }

  const items: DiscoveredItem[] = [];
  const seen = new Set<string>();
  for (const raw of record.items) {
    if (items.length >= limit) {
      break;
    }
    const result = asRecord(raw);
    const id = asRecord(result?.id);
    const snippet = asRecord(result?.snippet);
    const videoId = typeof id?.videoId === "string" ? id.videoId : "";
    if (
      result?.kind !== "youtube#searchResult" ||
      id?.kind !== "youtube#video" ||
      !VIDEO_ID.test(videoId) ||
      seen.has(videoId) ||
      !snippet
    ) {
      continue;
    }

    const title = sanitizedMetadata(snippet.title, 300);
    if (!title) {
      continue;
    }
    seen.add(videoId);
    const description = sanitizedMetadata(snippet.description, 800);
    const author = sanitizedMetadata(snippet.channelTitle, 200);
    items.push({
      sourceUrl: canonicalYouTubeUrl(videoId),
      title,
      publishedAt: sanitizedMetadata(snippet.publishedAt, 64),
      sourceType: "youtube",
      rawExcerpt: description,
      externalId: videoId,
      ...(author ? { author } : {}),
    });
  }
  return items;
}

export function canonicalYouTubeUrl(videoId: string): string {
  if (!VIDEO_ID.test(videoId)) {
    throw new YouTubeSourceProviderError(
      "malformed_response",
      "YouTube provider returned an invalid video identifier.",
    );
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}
