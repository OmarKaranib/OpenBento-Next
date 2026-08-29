import type { SourceType } from "@openbento/domain";
import type { DiscoveredItem } from "./provider";
import { sanitizeUntrustedText } from "./untrusted";

export const WATCHBOT_V0_SOURCE_TYPES = ["web", "news"] as const;
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
}

export function isWatchBotV0SourceType(
  value: string,
): value is WatchBotV0SourceType {
  return (WATCHBOT_V0_SOURCE_TYPES as readonly string[]).includes(value);
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

export function parsePublishedAt(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return fallback;
  }
  return new Date(timestamp).toISOString();
}

/**
 * Normalize a discovered item. Returns null when the item is not a v0 web/news
 * source or has no usable URL. Source text is data only.
 */
export function normalizeDiscoveredItem(
  item: DiscoveredItem,
  discoveredAt: string,
): NormalizedItem | null {
  if (!isWatchBotV0SourceType(item.sourceType)) {
    return null;
  }
  const canonicalUrl = canonicalizeUrl(item.sourceUrl);
  if (!canonicalUrl) {
    return null;
  }
  const title = sanitizeUntrustedText(item.title, 300);
  if (!title) {
    return null;
  }
  return {
    sourceUrl: canonicalUrl,
    canonicalUrl,
    title,
    publishedAt: parsePublishedAt(item.publishedAt, discoveredAt),
    sourceType: item.sourceType,
    snippet: sanitizeUntrustedText(item.rawExcerpt ?? "", 800),
    discoveredAt,
  };
}

export function sourceTypeToCardType(
  sourceType: WatchBotV0SourceType,
): "web" | "news" {
  return sourceType === "news" ? "news" : "web";
}

export function asSourceType(sourceType: WatchBotV0SourceType): SourceType {
  return sourceType;
}
