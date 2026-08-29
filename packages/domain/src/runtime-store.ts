import { DomainError } from "./errors";
import type { DomainSqlAdapter } from "./sql-adapter";
import { createSupabaseJsAdapter, readSupabaseEnv } from "./supabase-js-adapter";
import { SupabaseDomainStore } from "./supabase-store";
import type { DomainStore } from "./store";

let injected: DomainStore | undefined;
let singleton: DomainStore | undefined;
let adapterOverride: DomainSqlAdapter | undefined;
let accessTokenResolver: (() => Promise<string | null>) | undefined;

/**
 * Same DomainStore for UI, WebMCP, and the WatchBot worker.
 * Always `SupabaseDomainStore`. No InMemory runtime fallback.
 */
export function getDomainStore(): DomainStore {
  if (injected) {
    return injected;
  }
  if (!singleton) {
    singleton = createSupabaseDomainStore();
  }
  if (!(singleton instanceof SupabaseDomainStore)) {
    throw new DomainError(
      "invalid_input",
      "getDomainStore() must return SupabaseDomainStore",
    );
  }
  return singleton;
}

export function createSupabaseDomainStore(
  adapter: DomainSqlAdapter = adapterOverride ??
    createSupabaseJsAdapter({
      ...readSupabaseEnv(),
      getAccessToken: accessTokenResolver,
    }),
): SupabaseDomainStore {
  return new SupabaseDomainStore(adapter);
}

/** Web request path: resolve the user JWT so RLS sees auth.uid(). */
export function setSupabaseAccessTokenResolver(
  resolver: (() => Promise<string | null>) | undefined,
): void {
  accessTokenResolver = resolver;
  singleton = undefined;
}

/** Isolated tests only. Runtime never injects InMemoryDomainStore. */
export function setDomainStore(store: DomainStore): void {
  injected = store;
}

export function resetDomainStore(): void {
  injected = undefined;
  singleton = undefined;
}

/** Isolated tests: swap the SQL adapter used by createSupabaseDomainStore(). */
export function setDomainSqlAdapterForTests(adapter: DomainSqlAdapter | undefined): void {
  adapterOverride = adapter;
  singleton = undefined;
}
