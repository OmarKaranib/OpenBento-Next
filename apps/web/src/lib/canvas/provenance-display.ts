/**
 * Display helpers for sourced Card identity.
 * Never fabricates missing provenance. Never returns unsanitized HTML.
 */

import type { Card, CardType, SourceType } from "@openbento/domain";
import { knownPublishedAtLabel } from "@/lib/domain/source-card";
import { safeHttpUrl, sanitizeUntrustedDisplayText } from "@/lib/untrusted";

const KIND_BY_CARD_TYPE: Partial<Record<CardType, string>> = {
  youtube: "YouTube",
  x: "X",
  news: "News",
  article: "Article",
  web: "Web",
};

const KIND_BY_SOURCE_TYPE: Partial<Record<SourceType, string>> = {
  youtube: "YouTube",
  x: "X",
  news: "News",
  web: "Web",
};

export type ProvenanceDisplay = {
  kind: string | null;
  href: string | null;
  displayUrl: string | null;
  publishedAt: string | null;
  discoveredAt: string | null;
};

export function sourceKindLabel(card: Card): string | null {
  if (card.type === "note") {
    return null;
  }
  const fromType = KIND_BY_CARD_TYPE[card.type];
  if (fromType) {
    return fromType;
  }
  if ("provenance" in card.payload) {
    return KIND_BY_SOURCE_TYPE[card.payload.provenance.sourceType] ?? null;
  }
  return null;
}

/** http(s) only. javascript:/data:/credentialed URLs are null. */
export function sanitizedSourceHref(value: unknown): string | null {
  return safeHttpUrl(value);
}

/** Same rules as publishedAt: empty / unparseable stays empty. Do not mint now. */
export function knownDiscoveredAtLabel(value: unknown): string | null {
  return knownPublishedAtLabel(value);
}

export function provenanceDisplay(card: Card): ProvenanceDisplay | null {
  if (!("provenance" in card.payload)) {
    return null;
  }
  const provenance = card.payload.provenance;
  const href = sanitizedSourceHref(provenance.sourceUrl);
  return {
    kind: sourceKindLabel(card),
    href,
    displayUrl: href ? sanitizeUntrustedDisplayText(href) : null,
    publishedAt: knownPublishedAtLabel(provenance.publishedAt),
    discoveredAt: knownDiscoveredAtLabel(provenance.discoveredAt),
  };
}
