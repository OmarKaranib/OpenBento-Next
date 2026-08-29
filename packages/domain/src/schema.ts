/**
 * Record shapes matching `supabase/migrations`.
 * Platform applies reviewed SQL to the hosted **dev** project. Do not apply
 * them from this agent. Do not create or mutate a production Supabase project.
 * ownerId is stored on Canvas and WatchBot rows; it is never an action input.
 */

import type {
  CardType,
  OwnerId,
  SourceType,
  Viewport,
  WatchBotEventKind,
  WatchBotSourceType,
  WatchBotStatus,
} from "./types";


export interface CanvasRecord {
  id: string;
  owner_id: OwnerId;
  name: string;
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
}

export interface CardRecord {
  id: string;
  canvas_id: string;
  frame_id: string | null;
  type: CardType;
  /** Typed payload JSON for `type`. Not title/body columns. */
  payload: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface FrameRecord {
  id: string;
  canvas_id: string;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface WatchBotRecord {
  id: string;
  owner_id: OwnerId;
  canvas_id: string;
  name: string | null;
  instruction: string;
  status: WatchBotStatus;
  source_types: WatchBotSourceType[];
  last_error: string | null;
  last_activity_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

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

export type ViewportColumns = Viewport;
