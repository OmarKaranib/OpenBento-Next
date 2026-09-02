/**
 * Presentation-only current-Canvas Card search/filter.
 *
 * Matching never calls domain actions and never mutates Card geometry,
 * frame membership, or stored payloads. XYFlow hides unmatched Cards.
 */

import type { Card, CardType, SourceType } from "@openbento/domain";
import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";

/** Types exposed in the Canvas monitor chrome. `x` exists on the domain catalog. */
export const MONITOR_CARD_TYPES = [
  "note",
  "youtube",
  "article",
  "web",
  "x",
] as const satisfies readonly CardType[];

export type MonitorCardType = (typeof MONITOR_CARD_TYPES)[number];

export const MONITOR_TYPE_OPTIONS: ReadonlyArray<{
  type: MonitorCardType;
  label: string;
}> = [
  { type: "note", label: "Note" },
  { type: "youtube", label: "YouTube" },
  { type: "article", label: "Article" },
  { type: "web", label: "Web" },
  { type: "x", label: "X" },
];

export type CanvasMonitorFilter = {
  query: string;
  /** Empty = all Card types. */
  types: readonly CardType[];
  /** Empty = all sourceTypes. Notes fail this filter when it is non-empty. */
  sourceTypes: readonly SourceType[];
  newOnly: boolean;
};

export function emptyMonitorFilter(): CanvasMonitorFilter {
  return {
    query: "",
    types: [],
    sourceTypes: [],
    newOnly: false,
  };
}

export function monitorFilterIsActive(filter: CanvasMonitorFilter): boolean {
  return (
    filter.query.trim().length > 0 ||
    filter.types.length > 0 ||
    filter.sourceTypes.length > 0 ||
    filter.newOnly
  );
}

/**
 * Search haystack: Note text, or source provenance title.
 * Untrusted strings are sanitized to plain text before matching.
 */
export function cardSearchText(card: Card): string {
  if (card.type === "note") {
    return sanitizeUntrustedDisplayText(card.payload.text);
  }
  if ("provenance" in card.payload) {
    return sanitizeUntrustedDisplayText(card.payload.provenance.title);
  }
  return "";
}

export function cardMatchesMonitorFilter(
  card: Card,
  filter: CanvasMonitorFilter,
  newCardIds: ReadonlySet<string>,
): boolean {
  if (filter.types.length > 0 && !filter.types.includes(card.type)) {
    return false;
  }
  if (filter.sourceTypes.length > 0) {
    if (!("provenance" in card.payload)) {
      return false;
    }
    if (!filter.sourceTypes.includes(card.payload.provenance.sourceType)) {
      return false;
    }
  }
  if (filter.newOnly && !newCardIds.has(card.id)) {
    return false;
  }
  const query = filter.query.trim().toLowerCase();
  if (query.length === 0) {
    return true;
  }
  return cardSearchText(card).toLowerCase().includes(query);
}
