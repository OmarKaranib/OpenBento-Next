import type {
  SourceType,
  XCardMedia,
  XCardMetrics,
  XCardPresentation,
} from "@openbento/domain";
import type { DiscoveredItem } from "./provider";
import { sanitizeUntrustedText } from "./untrusted";

export const WATCHBOT_V0_SOURCE_TYPES = [
  "web",
  "news",
  "youtube",
  "x",
] as const;
export type WatchBotV0SourceType = (typeof WATCHBOT_V0_SOURCE_TYPES)[number];

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "si",
  "ref",
  "ref_src",
  "ref_url",
]);

export interface NormalizedItem {
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  publishedAt: string;
  sourceType: WatchBotV0SourceType;
  snippet: string;
  discoveredAt: string;
  author?: string;
  externalId?: string;
  x?: XCardPresentation;
}

export function isWatchBotV0SourceType(
  value: string,
): value is WatchBotV0SourceType {
  return (WATCHBOT_V0_SOURCE_TYPES as readonly string[]).includes(value);
}

const BLOCKED_V0_HOSTS = [
  "youtube.com",
  "youtu.be",
  "x.com",
  "twitter.com",
] as const;

const X_HOSTS = ["x.com", "twitter.com"] as const;

/** Provider-owned hosts cannot be accepted as generic web/news sources. */
export function isBlockedWatchBotV0Host(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return BLOCKED_V0_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`),
  );
}

export function isBlockedWatchBotV0Url(raw: string): boolean {
  try {
    const url = new URL(raw);
    return isBlockedWatchBotV0Host(url.hostname);
  } catch {
    return false;
  }
}

function isXUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return X_HOSTS.some(
      (xHost) => host === xHost || host.endsWith(`.${xHost}`),
    );
  } catch {
    return false;
  }
}

function safeXAssetUrl(
  value: unknown,
  allowedHosts: readonly string[],
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      allowedHosts.includes(url.hostname.toLowerCase())
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function optionalCount(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0
    ? (value as number)
    : undefined;
}

function normalizeXMetrics(value: XCardMetrics | undefined): XCardMetrics | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const metrics: XCardMetrics = {};
  for (const key of [
    "replyCount",
    "repostCount",
    "quoteCount",
    "likeCount",
    "viewCount",
    "bookmarkCount",
  ] as const) {
    const count = optionalCount(value[key]);
    if (count !== undefined) {
      metrics[key] = count;
    }
  }
  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

function normalizeXMedia(value: XCardMedia): XCardMedia | null {
  if (
    !value ||
    typeof value !== "object" ||
    !/^\d+_\d+$/.test(value.mediaKey) ||
    !["photo", "video", "animated_gif"].includes(value.type)
  ) {
    return null;
  }
  const url = safeXAssetUrl(value.url, ["pbs.twimg.com"]);
  const previewImageUrl = safeXAssetUrl(value.previewImageUrl, ["pbs.twimg.com"]);
  const playbackUrl = safeXAssetUrl(value.playbackUrl, ["video.twimg.com"]);
  if (
    (value.type === "photo" && !url) ||
    (value.type !== "photo" && !previewImageUrl && !playbackUrl)
  ) {
    return null;
  }
  const width = optionalCount(value.width);
  const height = optionalCount(value.height);
  const durationMs = optionalCount(value.durationMs);
  const viewCount = optionalCount(value.viewCount);
  const altText = sanitizeUntrustedText(value.altText, 1_000);
  return {
    mediaKey: value.mediaKey,
    type: value.type,
    ...(url ? { url } : {}),
    ...(previewImageUrl ? { previewImageUrl } : {}),
    ...(playbackUrl ? { playbackUrl } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(viewCount !== undefined ? { viewCount } : {}),
    ...(altText ? { altText } : {}),
  };
}

function normalizeXPresentation(
  value: XCardPresentation | undefined,
): XCardPresentation | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const postText = sanitizeUntrustedText(value.postText, 5_000);
  const authorDisplayName = sanitizeUntrustedText(value.authorDisplayName, 200);
  const username = sanitizeUntrustedText(value.username, 15);
  const authorAvatarUrl = safeXAssetUrl(value.authorAvatarUrl, ["pbs.twimg.com"]);
  const metrics = normalizeXMetrics(value.metrics);
  const media = Array.isArray(value.media)
    ? value.media.flatMap((item) => {
        const normalized = normalizeXMedia(item);
        return normalized ? [normalized] : [];
      }).slice(0, 4)
    : [];
  const normalized: XCardPresentation = {
    ...(postText ? { postText } : {}),
    ...(authorDisplayName ? { authorDisplayName } : {}),
    ...(/^[A-Za-z0-9_]{1,15}$/.test(username) ? { username } : {}),
    ...(authorAvatarUrl ? { authorAvatarUrl } : {}),
    ...(metrics ? { metrics } : {}),
    ...(media.length > 0 ? { media } : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Accept only the official canonical watch-page shape used by the adapter. */
export function youtubeVideoIdFromWatchUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "www.youtube.com" ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== "" ||
      url.pathname !== "/watch"
    ) {
      return null;
    }
    const videoId = url.searchParams.get("v") ?? "";
    return YOUTUBE_VIDEO_ID.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

export function canonicalYouTubeWatchUrl(videoId: string): string | null {
  return YOUTUBE_VIDEO_ID.test(videoId)
    ? `https://www.youtube.com/watch?v=${videoId}`
    : null;
}

/** Canonical URL: lowercase host, drop hash, drop tracking params, drop trailing slash. */
export function canonicalizeUrl(raw: string): string | null {
  const trimmed = sanitizeUntrustedText(raw, 2_000);
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    const kept = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (!TRACKING_PARAMS.has(key.toLowerCase())) {
        kept.append(key, value);
      }
    });
    const query = kept.toString();
    url.search = query ? `?${query}` : "";
    let href = url.toString();
    if (href.endsWith("/") && url.pathname === "/") {
      return href;
    }
    if (href.endsWith("/") && url.pathname !== "/") {
      href = href.slice(0, -1);
    }
    return href;
  } catch {
    return null;
  }
}

/**
 * Persist a real publication time only. Empty string when unknown or unparseable.
 * Never mint `now` / `discoveredAt` / `new Date().toISOString()`.
 */
export function parsePublishedAt(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "";
  }
  return new Date(timestamp).toISOString();
}

/**
 * Normalize a discovered item. Provider-owned sources stay correctly typed:
 * X and YouTube URLs labelled web/news are rejected rather than coerced.
 * YouTube is reduced to the canonical official watch URL. Source text is data
 * only.
 */
export function normalizeDiscoveredItem(
  item: DiscoveredItem,
  discoveredAt: string,
): NormalizedItem | null {
  if (!isWatchBotV0SourceType(item.sourceType)) {
    return null;
  }
  const youtubeVideoId =
    item.sourceType === "youtube"
      ? youtubeVideoIdFromWatchUrl(item.sourceUrl)
      : null;
  if (
    (item.sourceType === "x" && !isXUrl(item.sourceUrl)) ||
    (item.sourceType !== "x" && isXUrl(item.sourceUrl)) ||
    (item.sourceType === "youtube" && !youtubeVideoId) ||
    (item.sourceType !== "youtube" &&
      item.sourceType !== "x" &&
      isBlockedWatchBotV0Url(item.sourceUrl))
  ) {
    return null;
  }
  const canonicalUrl = youtubeVideoId
    ? canonicalYouTubeWatchUrl(youtubeVideoId)
    : canonicalizeUrl(item.sourceUrl);
  if (
    !canonicalUrl ||
    (item.sourceType === "x" && !isXUrl(canonicalUrl)) ||
    (item.sourceType === "youtube" &&
      !youtubeVideoIdFromWatchUrl(canonicalUrl)) ||
    (item.sourceType !== "youtube" &&
      item.sourceType !== "x" &&
      isBlockedWatchBotV0Url(canonicalUrl))
  ) {
    return null;
  }
  const title = sanitizeUntrustedText(item.title, 300);
  if (!title) {
    return null;
  }
  const x = item.sourceType === "x" ? normalizeXPresentation(item.x) : undefined;
  return {
    sourceUrl: canonicalUrl,
    canonicalUrl,
    title,
    publishedAt: parsePublishedAt(item.publishedAt),
    sourceType: item.sourceType,
    snippet: sanitizeUntrustedText(item.rawExcerpt ?? "", 800),
    discoveredAt,
    ...(item.author
      ? { author: sanitizeUntrustedText(item.author, 200) }
      : {}),
    ...(item.externalId
      ? { externalId: sanitizeUntrustedText(item.externalId, 200) }
      : {}),
    ...(x ? { x } : {}),
  };
}

export function sourceTypeToCardType(
  sourceType: WatchBotV0SourceType,
): "web" | "news" | "youtube" | "x" {
  if (sourceType === "news") {
    return "news";
  }
  if (sourceType === "x") {
    return "x";
  }
  if (sourceType === "youtube") {
    return "youtube";
  }
  return "web";
}

export function asSourceType(sourceType: WatchBotV0SourceType): SourceType {
  return sourceType;
}
