import type { NormalizedItem } from "./normalize";

/** Deterministic fingerprint for `UNIQUE (watch_bot_id, dedup_key)`. */
export function buildDedupKey(item: Pick<NormalizedItem, "sourceType" | "canonicalUrl">): string {
  return `${item.sourceType}:${item.canonicalUrl}`;
}
