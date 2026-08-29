import {
  createWebMcpRuntime,
  type DomainStore,
  type WebMcpExecute,
  type WebMcpRuntime,
  type WebMcpToolEvent,
} from "@openbento/domain";
import { runBoundAction } from "../server/run-action";
import { requireSessionOwnerId } from "../server/session";
import { getDomainStore } from "../server/store";

/**
 * Session-bound catalog execute for WebMCP.
 * ownerId comes only from `requireSessionOwnerId` (AuthSessionPort).
 * `createActionExecutor` runs inside `runBoundAction`. No local-session
 * fallback and no second ownerId constructor.
 */
export function createSessionBoundExecute(store?: DomainStore): WebMcpExecute {
  const resolved = store ?? getDomainStore();
  return (name, input) =>
    runBoundAction(
      { getOwnerId: requireSessionOwnerId, store: resolved },
      name,
      input,
    );
}

export function createBoundWebMcpRuntime(options?: {
  store?: DomainStore;
  onToolEvent?: (event: WebMcpToolEvent) => void;
}): WebMcpRuntime {
  return createWebMcpRuntime({
    execute: createSessionBoundExecute(options?.store),
    onToolEvent: options?.onToolEvent,
  });
}
