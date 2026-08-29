/**
 * Proposed **local/dev** record shapes only.
 *
 * - Do not apply this to any database.
 * - Do not add SQL under `supabase/migrations` from this sketch.
 * - Do not invent columns or tables beyond WatchBot and WatchBotEvent / discovery.
 * - Production Supabase is out of scope for this phase.
 *
 * WatchBot Engineer uses these shapes for dedup + novelty in a later
 * `apps/worker` branch. No handlers live here.
 */

import type {
  FirstSliceSourceType,
  SourceType,
  WatchBotEventKind,
  WatchBotStatus,
} from "./types";

/**
 * Proposed `watch_bots` row (local/dev only).
 *
 * Suggested uniqueness: one active WatchBot per `canvas_id` (product may
 * relax this later; do not invent extra tables to work around it).
 */
export interface WatchBotRecord {
  id: string;
  canvas_id: string;
  status: WatchBotStatus;
  /** First slice: web and/or news. */
  source_types: FirstSliceSourceType[];
  label: string | null;
  created_at: string;
  updated_at: string;
  last_error: string | null;
}

/**
 * Proposed `watch_bot_events` discovery row (local/dev only).
 *
 * Used for **dedup** (`dedup_key` unique per `watch_bot_id`) and **novelty**
 * (`novelty_score`, `discovered_at` vs prior rows for the same bot/canvas).
 *
 * This is the discovery record. Do not invent a second discovery table.
 */
export interface WatchBotEventRecord {
  id: string;
  watch_bot_id: string;
  canvas_id: string;
  kind: WatchBotEventKind;
  source_url: string;
  dedup_key: string;
  novelty_score: number | null;
  discovered_at: string;
  title: string | null;
  published_at: string | null;
  source_type: SourceType | null;
  card_id: string | null;
  detail: string | null;
}

/**
 * Card provenance columns that must exist on any future card row.
 * Required by `createCard` / `updateCard`. Not a standalone table.
 */
export interface CardProvenanceColumns {
  source_url: string;
  title: string;
  published_at: string;
  source_type: SourceType;
}
