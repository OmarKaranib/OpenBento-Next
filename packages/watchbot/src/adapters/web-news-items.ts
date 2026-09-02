/**
 * Shared web/news discovery extraction for Responses-shaped envelopes.
 * Vendor-neutral: Grok and OpenAI adapters both use this. Domain does not.
 *
 * Protocol JSON is parsed once. Titles, snippets, and HTML are never
 * JSON.parsed into extra discoveries. YouTube / X URLs are dropped and
 * never coerced to web.
 */

import type { DiscoveredItem } from "../provider";
import { isBlockedWatchBotV0Url } from "../normalize";

const WEB_NEWS_SOURCE_TYPES = ["web", "news"] as const;
export type WebNewsSourceType = (typeof WEB_NEWS_SOURCE_TYPES)[number];

export function isWebNewsSourceType(value: string): value is WebNewsSourceType {
  return (WEB_NEWS_SOURCE_TYPES as readonly string[]).includes(value);
}

/**
 * Collect items from the already-parsed HTTP envelope, plus at most one
 * JSON.parse of each Responses `output_text` protocol field.
 * Never JSON.parse titles, snippets, HTML, or other untrusted strings.
 */
export function extractDiscoveredItems(body: unknown): DiscoveredItem[] {
  const collected: DiscoveredItem[] = [];
  const seen = new Set<string>();

  const addFrom = (value: unknown): void => {
    walkStructuredRecords(value, (record) => {
      const item = itemFromRecord(record);
      if (!item || seen.has(item.sourceUrl)) {
        return;
      }
      seen.add(item.sourceUrl);
      collected.push(item);
    });
  };

  addFrom(body);
  for (const text of collectProtocolOutputTexts(body)) {
    const parsed = parseJsonOnce(text);
    if (parsed !== undefined) {
      addFrom(parsed);
    }
  }
  return collected;
}

function walkStructuredRecords(
  value: unknown,
  onRecord: (record: Record<string, unknown>) => void,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkStructuredRecords(entry, onRecord);
    }
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  const record = value as Record<string, unknown>;
  onRecord(record);
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      walkStructuredRecords(nested, onRecord);
    }
  }
}

/** Responses API protocol fields only. Item title/snippet `text` is not collected. */
function collectProtocolOutputTexts(value: unknown): string[] {
  const texts: string[] = [];
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const root = value as Record<string, unknown>;
    if (typeof root.output_text === "string") {
      texts.push(root.output_text);
    }
  }
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) {
        walk(entry);
      }
      return;
    }
    if (typeof node !== "object" || node === null) {
      return;
    }
    const record = node as Record<string, unknown>;
    const type = record.type;
    if (
      (type === "output_text" || type === "text") &&
      typeof record.text === "string"
    ) {
      texts.push(record.text);
    }
    if (Array.isArray(record.output)) {
      walk(record.output);
    }
    if (Array.isArray(record.content)) {
      walk(record.content);
    }
    if (record.message && typeof record.message === "object") {
      walk(record.message);
    }
  };
  walk(value);
  return texts;
}

function parseJsonOnce(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function itemFromRecord(record: Record<string, unknown>): DiscoveredItem | null {
  const url =
    pickString(record, ["sourceUrl", "url", "canonicalUrl"]) ??
    pickString(record, ["uri"]);
  const title = pickString(record, ["title", "name", "headline"]);
  if (!url || !title) {
    return null;
  }
  if (isBlockedWatchBotV0Url(url)) {
    return null;
  }
  const sourceTypeRaw = pickString(record, ["sourceType", "type"]);
  const sourceType = resolveV0SourceType(sourceTypeRaw);
  if (!sourceType) {
    return null;
  }
  return {
    sourceUrl: url,
    title,
    publishedAt:
      pickString(record, ["publishedAt", "published_at", "date"]) ?? "",
    sourceType,
    rawExcerpt: pickString(record, ["rawExcerpt", "snippet", "text"]),
  };
}

/**
 * Keep web/news. Drop youtube/x and unknown types. Never coerce them to web.
 */
function resolveV0SourceType(raw: string | undefined): WebNewsSourceType | null {
  if (raw === undefined || raw === "") {
    return "web";
  }
  if (isWebNewsSourceType(raw)) {
    return raw;
  }
  if (raw === "article" || raw === "url_citation" || raw === "web_search_result") {
    return "web";
  }
  return null;
}

function pickString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}
