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
 * Request-scoped persist for UI, WebMCP, and runBoundAction.
 * `getDomainStore()` → `SupabaseDomainStore` with the user JWT only.
 * Never uses SUPABASE_SERVICE_ROLE_KEY. No InMemory runtime fallback.
 */
export { getDomainStore, resetDomainStore, setDomainStore };
export type { DomainStore };
