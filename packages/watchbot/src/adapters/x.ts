import type {
  XCardMedia,
  XCardMetrics,
  XCardPresentation,
} from "@openbento/domain";
import type { DiscoveredItem, SourceProvider, SourceProviderDiscoverInput } from "../provider";
import { deriveProviderSearchQuery } from "../provider-query";
import { sanitizeUntrustedText } from "../untrusted";

const X_API_BASE_URL = "https://api.x.com/2";

/** Hard ceilings. Environment and constructor options can only reduce them. */
export const X_SOURCE_PROVIDER_LIMITS = {
  maxQueryLength: 512,
  maxResultsPerRequest: 100,
  maxPagesPerCycle: 3,
  maxRequestsPerCycle: 3,
  maxResultsPerCycle: 30,
  timeoutMs: 15_000,
} as const;

const DEFAULTS = {
  maxQueryLength: 512,
  maxResultsPerRequest: 10,
  maxPagesPerCycle: 1,
  maxRequestsPerCycle: 1,
  maxResultsPerCycle: 10,
  timeoutMs: 10_000,
} as const;

export type XSourceProviderErrorCode =
  | "credential_missing"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "timeout"
  | "network"
  | "transient_server"
  | "malformed_response"
  | "invalid_query";

/** Classified adapter failure. The adapter never retries automatically. */
export class XSourceProviderError extends Error {
  readonly code: XSourceProviderErrorCode;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(
    code: XSourceProviderErrorCode,
    message: string,
    options?: { retryable?: boolean; retryAfterMs?: number },
  ) {
    super(message);
    this.name = "XSourceProviderError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export interface XSourceProviderOptions {
  enabled: boolean;
  bearerToken?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxQueryLength?: number;
  maxResultsPerRequest?: number;
  maxPagesPerCycle?: number;
  maxRequestsPerCycle?: number;
  maxResultsPerCycle?: number;
  timeoutMs?: number;
}

type ResolvedXSourceProviderOptions = {
  enabled: boolean;
  bearerToken?: string;
  baseUrl: string;
  fetchImpl: typeof fetch;
  maxQueryLength: number;
  maxResultsPerRequest: number;
  maxPagesPerCycle: number;
  maxRequestsPerCycle: number;
  maxResultsPerCycle: number;
  timeoutMs: number;
};

type XSearchTweet = {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  mediaKeys: string[];
  metrics?: XCardMetrics;
};

type XSearchResponse = {
  tweets: XSearchTweet[];
  nextToken?: string;
  usersByUserId: Map<string, XCardPresentation>;
  mediaByKey: Map<string, XCardMedia>;
};

function boundedInt(
  value: number | string | undefined,
  fallback: number,
  maximum: number,
  minimum = 1,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fallback;
  }
  return Math.min(parsed, maximum);
}

function xProviderEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.X_PROVIDER_ENABLED === "true";
}

export function xBearerToken(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const token = env.X_BEARER_TOKEN?.trim();
  return token ? token : undefined;
}

function resolveOptions(
  options: Partial<XSourceProviderOptions>,
  env: NodeJS.ProcessEnv,
): ResolvedXSourceProviderOptions {
  return {
    enabled: options.enabled ?? xProviderEnabled(env),
    bearerToken: options.bearerToken ?? xBearerToken(env),
    baseUrl: (options.baseUrl ?? X_API_BASE_URL).replace(/\/$/, ""),
    fetchImpl: options.fetchImpl ?? fetch,
    maxQueryLength: boundedInt(
      options.maxQueryLength ?? env.X_MAX_QUERY_LENGTH,
      DEFAULTS.maxQueryLength,
      X_SOURCE_PROVIDER_LIMITS.maxQueryLength,
    ),
    maxResultsPerRequest: boundedInt(
      options.maxResultsPerRequest ?? env.X_MAX_RESULTS_PER_REQUEST,
      DEFAULTS.maxResultsPerRequest,
      X_SOURCE_PROVIDER_LIMITS.maxResultsPerRequest,
      10,
    ),
    maxPagesPerCycle: boundedInt(
      options.maxPagesPerCycle ?? env.X_MAX_PAGES_PER_CYCLE,
      DEFAULTS.maxPagesPerCycle,
      X_SOURCE_PROVIDER_LIMITS.maxPagesPerCycle,
    ),
    maxRequestsPerCycle: boundedInt(
      options.maxRequestsPerCycle ?? env.X_MAX_REQUESTS_PER_CYCLE,
      DEFAULTS.maxRequestsPerCycle,
      X_SOURCE_PROVIDER_LIMITS.maxRequestsPerCycle,
    ),
    maxResultsPerCycle: boundedInt(
      options.maxResultsPerCycle ?? env.X_MAX_RESULTS_PER_CYCLE,
      DEFAULTS.maxResultsPerCycle,
      X_SOURCE_PROVIDER_LIMITS.maxResultsPerCycle,
    ),
    timeoutMs: boundedInt(
      options.timeoutMs ?? env.X_PROVIDER_TIMEOUT_MS,
      DEFAULTS.timeoutMs,
      X_SOURCE_PROVIDER_LIMITS.timeoutMs,
    ),
  };
}

/**
 * Optional official X API v2 adapter. The lane is disabled by default, and an
 * enabled adapter requires a worker-only X_BEARER_TOKEN before it can run.
 */
export function createXSourceProvider(
  options: Partial<XSourceProviderOptions> = {},
  env: NodeJS.ProcessEnv = process.env,
): SourceProvider {
  const resolved = resolveOptions(options, env);
  if (resolved.enabled && !resolved.bearerToken) {
    throw new XSourceProviderError(
      "credential_missing",
      "X provider is enabled but X_BEARER_TOKEN is not configured.",
    );
  }
  return new XSourceProvider(resolved);
}

class XSourceProvider implements SourceProvider {
  readonly id = "x-api-v2";
  readonly vendor = "x-api" as const;

  constructor(private readonly options: ResolvedXSourceProviderOptions) {}

  async discover(input: SourceProviderDiscoverInput): Promise<DiscoveredItem[]> {
    if (!this.options.enabled || !input.sourceTypes.includes("x")) {
      return [];
    }
    const token = this.options.bearerToken;
    if (!token) {
      throw new XSourceProviderError("credential_missing", "X provider is not configured.");
    }

    const query = deriveProviderSearchQuery(
      input.instruction,
      "x",
      this.options.maxQueryLength,
    );
    if (!query) {
      throw new XSourceProviderError(
        "invalid_query",
        "X provider requires a non-empty monitoring instruction.",
      );
    }

    const items: DiscoveredItem[] = [];
    const seenTweetIds = new Set<string>();
    let pageToken: string | undefined;
    const maxRequests = Math.min(
      this.options.maxPagesPerCycle,
      this.options.maxRequestsPerCycle,
    );

    for (let requestCount = 0; requestCount < maxRequests; requestCount += 1) {
      const remaining = this.options.maxResultsPerCycle - items.length;
      if (remaining <= 0) {
        break;
      }
      if (input.xHttpBudget && !input.xHttpBudget.tryConsume()) {
        break;
      }
      const response = await this.fetchPage({
        query,
        token,
        pageToken,
        maxResults: Math.max(
          10,
          Math.min(this.options.maxResultsPerRequest, remaining),
        ),
      });
      for (const tweet of response.tweets) {
        if (items.length >= this.options.maxResultsPerCycle) {
          break;
        }
        if (seenTweetIds.has(tweet.id)) {
          continue;
        }
        seenTweetIds.add(tweet.id);
        const author = response.usersByUserId.get(tweet.authorId);
        const username = author?.username;
        if (!username) {
          continue;
        }
        const media = tweet.mediaKeys.flatMap((mediaKey) => {
          const attachment = response.mediaByKey.get(mediaKey);
          return attachment ? [attachment] : [];
        });
        items.push({
          sourceUrl: `https://x.com/${username}/status/${tweet.id}`,
          title: tweet.text,
          publishedAt: tweet.createdAt,
          sourceType: "x",
          rawExcerpt: tweet.text,
          author: username,
          externalId: tweet.id,
          x: {
            postText: tweet.text,
            ...author,
            ...(tweet.metrics ? { metrics: tweet.metrics } : {}),
            ...(media.length > 0 ? { media } : {}),
          },
        });
      }
      pageToken = response.nextToken;
      if (!pageToken) {
        break;
      }
    }
    return items;
  }

  private async fetchPage(input: {
    query: string;
    token: string;
    pageToken?: string;
    maxResults: number;
  }): Promise<XSearchResponse> {
    const params = new URLSearchParams({
      query: input.query,
      max_results: String(input.maxResults),
      "tweet.fields": "created_at,author_id,attachments,public_metrics",
      expansions: "author_id,attachments.media_keys",
      "user.fields": "username,name,profile_image_url",
      "media.fields":
        "media_key,type,url,preview_image_url,width,height,duration_ms,alt_text,public_metrics,variants",
    });
    if (input.pageToken) {
      params.set("next_token", input.pageToken);
    }
    const response = await fetchWithTimeout(
      this.options.fetchImpl,
      `${this.options.baseUrl}/tweets/search/recent?${params.toString()}`,
      {
        headers: {
          authorization: `Bearer ${input.token}`,
          accept: "application/json",
        },
      },
      this.options.timeoutMs,
    );

    if (!response.ok) {
      throw httpError(response);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new XSourceProviderError(
        "malformed_response",
        "X provider returned an unreadable response.",
      );
    }
    return parseXSearchResponse(body);
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
      throw new XSourceProviderError("timeout", "X provider request timed out.", {
        retryable: true,
      });
    }
    throw new XSourceProviderError(
      "network",
      "X provider request could not be completed.",
      { retryable: true },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function httpError(response: Response): XSourceProviderError {
  if (response.status === 401) {
    return new XSourceProviderError("unauthorized", "X provider rejected credentials.");
  }
  if (response.status === 403) {
    return new XSourceProviderError("forbidden", "X provider access is forbidden.");
  }
  if (response.status === 429) {
    return new XSourceProviderError("rate_limited", "X provider rate limit reached.", {
      retryable: true,
      retryAfterMs: retryAfterMs(response.headers.get("retry-after")),
    });
  }
  if (response.status >= 500 && response.status <= 599) {
    return new XSourceProviderError(
      "transient_server",
      "X provider is temporarily unavailable.",
      { retryable: true },
    );
  }
  return new XSourceProviderError(
    "malformed_response",
    "X provider rejected the search request.",
  );
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalNonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0
    ? (value as number)
    : undefined;
}

function parseMetrics(value: unknown): XCardMetrics | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const metrics: XCardMetrics = {};
  const mappings = [
    ["reply_count", "replyCount"],
    ["retweet_count", "repostCount"],
    ["quote_count", "quoteCount"],
    ["like_count", "likeCount"],
    ["impression_count", "viewCount"],
    ["bookmark_count", "bookmarkCount"],
  ] as const;
  for (const [providerKey, cardKey] of mappings) {
    const parsed = optionalNonNegativeInteger(record[providerKey]);
    if (parsed !== undefined) {
      metrics[cardKey] = parsed;
    }
  }
  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

function safeXAssetUrl(
  value: unknown,
  allowedHosts: readonly string[],
  requiredExtension?: string,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !allowedHosts.includes(url.hostname.toLowerCase()) ||
      (requiredExtension &&
        !url.pathname.toLowerCase().endsWith(requiredExtension))
    ) {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}

/** Select a directly playable official MP4 variant without trusting ordering. */
export function selectHighestBitrateMp4Variant(
  variants: unknown,
): string | undefined {
  if (!Array.isArray(variants)) {
    return undefined;
  }
  const playable = variants.flatMap((value) => {
    const variant = asRecord(value);
    if (variant?.content_type !== "video/mp4") {
      return [];
    }
    const url = safeXAssetUrl(variant.url, ["video.twimg.com"], ".mp4");
    if (!url) {
      return [];
    }
    const bitrate = optionalNonNegativeInteger(variant.bit_rate);
    return [{ url, bitrate }];
  });
  playable.sort((left, right) => (right.bitrate ?? -1) - (left.bitrate ?? -1));
  return playable[0]?.url;
}

function parseXMedia(value: unknown): XCardMedia | null {
  const media = asRecord(value);
  const mediaKey = typeof media?.media_key === "string" ? media.media_key : "";
  const type = media?.type;
  if (
    !/^\d+_\d+$/.test(mediaKey) ||
    (type !== "photo" && type !== "video" && type !== "animated_gif")
  ) {
    return null;
  }
  const parsed: XCardMedia = { mediaKey, type };
  const url = safeXAssetUrl(media?.url, ["pbs.twimg.com"]);
  const previewImageUrl = safeXAssetUrl(media?.preview_image_url, ["pbs.twimg.com"]);
  const playbackUrl = selectHighestBitrateMp4Variant(media?.variants);
  if (
    (type === "photo" && !url) ||
    (type !== "photo" && !previewImageUrl && !playbackUrl)
  ) {
    return null;
  }
  const width = optionalNonNegativeInteger(media?.width);
  const height = optionalNonNegativeInteger(media?.height);
  const durationMs = optionalNonNegativeInteger(media?.duration_ms);
  const altText = sanitizeUntrustedText(media?.alt_text, 1_000);
  const viewCount = optionalNonNegativeInteger(
    asRecord(media?.public_metrics)?.view_count,
  );
  return {
    ...parsed,
    ...(url ? { url } : {}),
    ...(previewImageUrl ? { previewImageUrl } : {}),
    ...(playbackUrl ? { playbackUrl } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(altText ? { altText } : {}),
    ...(viewCount !== undefined ? { viewCount } : {}),
  };
}

function parseXSearchResponse(body: unknown): XSearchResponse {
  const record = asRecord(body);
  const meta = asRecord(record?.meta);
  const data = record?.data;
  const isEmptyResponse = data === undefined && meta?.result_count === 0;
  if (!record || (!Array.isArray(data) && !isEmptyResponse)) {
    throw new XSourceProviderError(
      "malformed_response",
      "X provider response did not contain a data array.",
    );
  }
  const usersByUserId = new Map<string, XCardPresentation>();
  const mediaByKey = new Map<string, XCardMedia>();
  const includes = asRecord(record.includes);
  if (Array.isArray(includes?.users)) {
    for (const rawUser of includes.users) {
      const user = asRecord(rawUser);
      const id = typeof user?.id === "string" ? user.id : "";
      const username = typeof user?.username === "string" ? user.username : "";
      if (/^\d+$/.test(id) && /^[A-Za-z0-9_]{1,15}$/.test(username)) {
        const authorDisplayName = sanitizeUntrustedText(user?.name, 200);
        const authorAvatarUrl = safeXAssetUrl(user?.profile_image_url, [
          "pbs.twimg.com",
        ]);
        usersByUserId.set(id, {
          username,
          ...(authorDisplayName ? { authorDisplayName } : {}),
          ...(authorAvatarUrl ? { authorAvatarUrl } : {}),
        });
      }
    }
  }
  if (Array.isArray(includes?.media)) {
    for (const rawMedia of includes.media.slice(0, 100)) {
      const media = parseXMedia(rawMedia);
      if (media) {
        mediaByKey.set(media.mediaKey, media);
      }
    }
  }
  const tweets: XSearchTweet[] = [];
  for (const rawTweet of Array.isArray(data) ? data : []) {
    const tweet = asRecord(rawTweet);
    const id = typeof tweet?.id === "string" ? tweet.id : "";
    const text = typeof tweet?.text === "string" ? tweet.text : "";
    const authorId = typeof tweet?.author_id === "string" ? tweet.author_id : "";
    const createdAt = typeof tweet?.created_at === "string" ? tweet.created_at : "";
    if (!/^\d+$/.test(id) || !text || !/^\d+$/.test(authorId)) {
      continue;
    }
    const attachments = asRecord(tweet?.attachments);
    const mediaKeys = Array.isArray(attachments?.media_keys)
      ? attachments.media_keys
          .filter(
            (mediaKey): mediaKey is string =>
              typeof mediaKey === "string" && /^\d+_\d+$/.test(mediaKey),
          )
          .slice(0, 4)
      : [];
    const metrics = parseMetrics(tweet?.public_metrics);
    tweets.push({
      id,
      text: sanitizeUntrustedText(text, 5_000),
      authorId,
      createdAt,
      mediaKeys,
      ...(metrics ? { metrics } : {}),
    });
  }
  const nextToken = typeof meta?.next_token === "string" ? meta.next_token : undefined;
  if (nextToken && !/^[a-z0-9]{1,256}$/i.test(nextToken)) {
    throw new XSourceProviderError(
      "malformed_response",
      "X provider response contained an invalid pagination token.",
    );
  }
  return { tweets, nextToken, usersByUserId, mediaByKey };
}
