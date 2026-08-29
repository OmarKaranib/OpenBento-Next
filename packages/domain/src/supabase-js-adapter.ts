import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "./errors";
import type {
  CanvasRecord,
  CardRecord,
  FrameRecord,
  WatchBotEventRecord,
  WatchBotRecord,
} from "./schema";
import type { DomainSqlAdapter } from "./sql-adapter";

/** Request-scoped web/UI/WebMCP env. Never carries a service-role key. */
export type WebSupabaseEnv = {
  url: string;
  publishableKey: string;
  getAccessToken?: () => Promise<string | null>;
};

/** Worker-only env. Service role is explicit — not used by getDomainStore(). */
export type WorkerSupabaseEnv = {
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
};

function mapPgError(error: { code?: string; message: string }): never {
  if (error.code === "23505") {
    throw new DomainError(
      "conflict",
      "watch_bot_events unique (watch_bot_id, dedup_key) violated",
    );
  }
  if (error.code === "23503") {
    throw new DomainError("invalid_input", error.message);
  }
  throw new DomainError("invalid_input", error.message);
}

function requirePublicSupabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new DomainError(
      "unauthenticated",
      "Supabase env is required (NEXT_PUBLIC_SUPABASE_URL and publishable/anon key). No in-memory runtime fallback.",
    );
  }
  return { url, publishableKey };
}

/**
 * Web / request-scoped env. Does not read SUPABASE_SERVICE_ROLE_KEY
 * even when that variable is present in a shared .env.
 */
export function readWebSupabaseEnv(): WebSupabaseEnv {
  return requirePublicSupabaseEnv();
}

/** @deprecated Use readWebSupabaseEnv. Never includes a service-role key. */
export function readSupabaseEnv(): WebSupabaseEnv {
  return readWebSupabaseEnv();
}

/**
 * Worker-only env. Reads SUPABASE_SERVICE_ROLE_KEY explicitly.
 * Must not be used by getDomainStore() / runBoundAction.
 */
export function readWorkerSupabaseEnv(): WorkerSupabaseEnv {
  const publicEnv = requirePublicSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new DomainError(
      "unauthenticated",
      "Worker persist requires an explicit SUPABASE_SERVICE_ROLE_KEY. Do not fall back to the web JWT client.",
    );
  }
  return { ...publicEnv, serviceRoleKey };
}

/** Publishable/anon key + user JWT. Never the service-role key. */
export async function createWebAuthedClient(
  env: WebSupabaseEnv,
): Promise<SupabaseClient> {
  const token = env.getAccessToken ? await env.getAccessToken() : null;
  return createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });
}

/** Worker service-role client. Not used by the web request path. */
export async function createWorkerAuthedClient(
  env: WorkerSupabaseEnv,
): Promise<SupabaseClient> {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createSupabaseJsAdapter(env: WebSupabaseEnv): DomainSqlAdapter {
  return createAdapter(() => createWebAuthedClient(env));
}

export function createWorkerSupabaseJsAdapter(
  env: WorkerSupabaseEnv,
): DomainSqlAdapter {
  return createAdapter(() => createWorkerAuthedClient(env));
}

function createAdapter(
  client: () => Promise<SupabaseClient>,
): DomainSqlAdapter {
  return {
    async getCanvas(id) {
      const { data, error } = await (await client())
        .from("canvases")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        mapPgError(error);
      }
      return (data as CanvasRecord | null) ?? null;
    },
    async upsertCanvas(row) {
      const { error } = await (await client()).from("canvases").upsert(row);
      if (error) {
        mapPgError(error);
      }
    },
    async listCanvasesByOwner(ownerId) {
      const { data, error } = await (await client())
        .from("canvases")
        .select("*")
        .eq("owner_id", ownerId);
      if (error) {
        mapPgError(error);
      }
      return (data as CanvasRecord[] | null) ?? [];
    },
    async getCard(id) {
      const { data, error } = await (await client())
        .from("cards")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        mapPgError(error);
      }
      return (data as CardRecord | null) ?? null;
    },
    async upsertCard(row) {
      const { error } = await (await client()).from("cards").upsert(row);
      if (error) {
        mapPgError(error);
      }
    },
    async listCardsByCanvas(canvasId) {
      const { data, error } = await (await client())
        .from("cards")
        .select("*")
        .eq("canvas_id", canvasId);
      if (error) {
        mapPgError(error);
      }
      return (data as CardRecord[] | null) ?? [];
    },
    async getFrame(id) {
      const { data, error } = await (await client())
        .from("frames")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        mapPgError(error);
      }
      return (data as FrameRecord | null) ?? null;
    },
    async upsertFrame(row) {
      const { error } = await (await client()).from("frames").upsert(row);
      if (error) {
        mapPgError(error);
      }
    },
    async listFramesByCanvas(canvasId) {
      const { data, error } = await (await client())
        .from("frames")
        .select("*")
        .eq("canvas_id", canvasId);
      if (error) {
        mapPgError(error);
      }
      return (data as FrameRecord[] | null) ?? [];
    },
    async getWatchBot(id) {
      const { data, error } = await (await client())
        .from("watch_bots")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        mapPgError(error);
      }
      return (data as WatchBotRecord | null) ?? null;
    },
    async upsertWatchBot(row) {
      const { error } = await (await client()).from("watch_bots").upsert(row);
      if (error) {
        mapPgError(error);
      }
    },
    async listWatchBotsByCanvas(canvasId) {
      const { data, error } = await (await client())
        .from("watch_bots")
        .select("*")
        .eq("canvas_id", canvasId);
      if (error) {
        mapPgError(error);
      }
      return (data as WatchBotRecord[] | null) ?? [];
    },
    async listWatchBots() {
      const { data, error } = await (await client())
        .from("watch_bots")
        .select("*");
      if (error) {
        mapPgError(error);
      }
      return (data as WatchBotRecord[] | null) ?? [];
    },
    async insertWatchBotEvent(row) {
      const { error } = await (await client())
        .from("watch_bot_events")
        .insert(row);
      if (error) {
        mapPgError(error);
      }
    },
    async listWatchBotEvents(watchBotId) {
      const { data, error } = await (await client())
        .from("watch_bot_events")
        .select("*")
        .eq("watch_bot_id", watchBotId);
      if (error) {
        mapPgError(error);
      }
      return (data as WatchBotEventRecord[] | null) ?? [];
    },
    async applyTransaction(ops) {
      const { error } = await (await client()).rpc("apply_domain_transaction", {
        ops,
      });
      if (error) {
        mapPgError(error);
      }
    },
  };
}
