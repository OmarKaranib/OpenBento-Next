"use server";

import type {
  ActionInputMap,
  ActionName,
  ActionResultMap,
} from "@openbento/domain";
import { cookies, headers } from "next/headers";
import { runInteractiveAgentTurn } from "@/agent/runtime";
import type { AgentTurnRequest, AgentTurnResult } from "@/agent/types";
import { idFactoryForOwner } from "./ids";
import { runBoundAction } from "./run-action";
import {
  requireOwnerIdFromRequest,
  type RequestAuthContext,
} from "./session";
import { getDomainStore } from "./store";
import { getSupabaseAuthUser } from "./supabase";

async function requestAuthFromIncoming(): Promise<RequestAuthContext> {
  const user = await getSupabaseAuthUser();
  return {
    cookies: await cookies(),
    headers: await headers(),
    verifiedUserId: user?.id,
    getUser: async () => user,
  };
}

/**
 * Authenticated Interactive Agent turn.
 * ownerId is session-derived via runBoundAction — never from the model.
 */
export async function sendAgentMessage(
  request: AgentTurnRequest,
): Promise<AgentTurnResult> {
  const auth = await requestAuthFromIncoming();
  const ownerId = await requireOwnerIdFromRequest(auth);
  const store = getDomainStore();
  const id = idFactoryForOwner(ownerId);

  const execute = async <K extends ActionName>(
    name: K,
    input: ActionInputMap[K],
  ): Promise<ActionResultMap[K]> =>
    runBoundAction(
      {
        getOwnerId: async () => ownerId,
        store,
        id,
      },
      name,
      input,
    );

  return runInteractiveAgentTurn({
    canvasId: request.canvasId,
    message: request.message,
    history: request.history,
    execute,
  });
}
