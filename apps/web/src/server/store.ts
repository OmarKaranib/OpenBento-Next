import {
  getDomainStore,
  resetDomainStore,
  setDomainStore,
  setSupabaseAccessTokenResolver,
  type DomainStore,
} from "@openbento/domain";
import { getSupabaseAccessToken } from "./supabase";

setSupabaseAccessTokenResolver(getSupabaseAccessToken);

/**
 * Persistence handle for server actions, WebMCP, and the worker.
 * Always the same `getDomainStore()` → `SupabaseDomainStore`.
 * No InMemory runtime fallback.
 */
export { getDomainStore, resetDomainStore, setDomainStore };
export type { DomainStore };
