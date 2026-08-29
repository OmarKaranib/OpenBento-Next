import {
  createActionExecutor,
  type ActionInputMap,
  type ActionName,
  type ActionResultMap,
  type DomainStore,
  type OwnerId,
} from "@openbento/domain";

/**
 * Bind catalog execution to a session owner. The client payload is never
 * consulted for identity.
 */
export async function runBoundAction<K extends ActionName>(
  deps: {
    getOwnerId: () => Promise<OwnerId>;
    store: DomainStore;
  },
  name: K,
  input: ActionInputMap[K],
): Promise<ActionResultMap[K]> {
  const ownerId = await deps.getOwnerId();
  return createActionExecutor({ store: deps.store, ownerId }).execute(
    name,
    input,
  );
}
