import {
  createActionExecutor,
  type ActionInputMap,
  type ActionName,
  type ActionResultMap,
  type DomainStore,
  type OwnerId,
} from "@openbento/domain";
import { idFactoryForOwner } from "./ids";
import {
  requireOwnerIdFromRequest,
  type RequestAuthContext,
} from "./session";
import { getDomainStore } from "./store";

/**
 * Bind catalog execution to a session owner. The client payload is never
 * consulted for identity.
 */
export async function runBoundAction<K extends ActionName>(
  deps: {
    getOwnerId: () => Promise<OwnerId>;
    store: DomainStore;
    id?: () => string;
  },
  name: K,
  input: ActionInputMap[K],
): Promise<ActionResultMap[K]> {
  const ownerId = await deps.getOwnerId();
  return createActionExecutor({
    store: deps.store,
    ownerId,
    id: deps.id,
  }).execute(name, input);
}

/**
 * Server catalog path used by Next.js actions and tests.
 * Owner is resolved from this request's cookies/headers, then bound.
 */
export async function runDomainActionFromRequest<K extends ActionName>(
  request: RequestAuthContext,
  name: K,
  input: ActionInputMap[K],
  options?: { store?: DomainStore; id?: () => string },
): Promise<ActionResultMap[K]> {
  const ownerId = requireOwnerIdFromRequest(request);
  return runBoundAction(
    {
      getOwnerId: async () => ownerId,
      store: options?.store ?? getDomainStore(),
      id: options?.id ?? idFactoryForOwner(ownerId),
    },
    name,
    input,
  );
}
