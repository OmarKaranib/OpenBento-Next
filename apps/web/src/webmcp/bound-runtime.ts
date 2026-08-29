import {
  createWebMcpRuntime,
  type ActionName,
  type WebMcpExecute,
  type WebMcpRuntime,
  type WebMcpToolEvent,
} from "@openbento/domain";
import { runBoundAction } from "../server/run-action";
import {
  requireOwnerIdFromRequest,
  type RequestAuthContext,
} from "../server/session";
import { getDomainStore } from "../server/store";

/**
 * Request-scoped catalog execute for WebMCP.
 * Always `runBoundAction({ getOwnerId: requireOwnerIdFromRequest, store: getDomainStore() })`.
 * Tools share the Canvas store. Unset request fails closed (unauthenticated).
 */
export function createSessionBoundExecute(
  request: RequestAuthContext = {},
): WebMcpExecute {
  return (name, input) =>
    runBoundAction(
      {
        getOwnerId: async () => requireOwnerIdFromRequest(request),
        store: getDomainStore(),
      },
      name,
      input,
    );
}

export function createBoundWebMcpRuntime(options?: {
  request?: RequestAuthContext;
  onToolEvent?: (event: WebMcpToolEvent) => void;
  onCatalogCall?: (name: ActionName) => void;
}): WebMcpRuntime {
  return createWebMcpRuntime({
    execute: createSessionBoundExecute(options?.request ?? {}),
    onToolEvent: options?.onToolEvent,
    onCatalogCall: options?.onCatalogCall,
  });
}
