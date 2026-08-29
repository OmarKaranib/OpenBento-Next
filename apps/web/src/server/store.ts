import { InMemoryDomainStore, type DomainStore } from "@openbento/domain";

/**
 * Persistence handle for server actions.
 * Local/dev uses the in-memory adapter. A later local Supabase store can
 * replace this without changing ACTION_CATALOG or the executor.
 * Not connected to a hosted database.
 */
let store: DomainStore = new InMemoryDomainStore();

export function getDomainStore(): DomainStore {
  return store;
}

export function setDomainStore(next: DomainStore): void {
  store = next;
}

export function resetDomainStore(): void {
  store = new InMemoryDomainStore();
}
