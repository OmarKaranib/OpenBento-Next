"use server";

import {
  DomainError,
  WEBMCP_TOOL_TO_ACTION,
  applyCardFrameFromGeometry,
  isWebMcpToolName,
  type ActionResultMap,
  type Card,
  type FrameContainmentCandidate,
  type WebMcpToolName,
} from "@openbento/domain";
import { cookies, headers } from "next/headers";
import {
  requireOwnerIdFromRequest,
  type RequestAuthContext,
} from "../server/session";
import { getSupabaseAuthUser } from "../server/supabase";
import { createBoundWebMcpRuntime, createSessionBoundExecute } from "./bound-runtime";

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
 * Server entry for `document.modelContext.registerTool` execute callbacks.
 * ownerId is `requireOwnerIdFromRequest` inside `runBoundAction`.
 * Store is `getDomainStore()` — same as Canvas. create_card / move_card /
 * resize_card follow up with setCardFrame from geometry inside invoke.
 */
export async function runWebMcpTool<N extends WebMcpToolName>(
  toolName: N,
  input: unknown,
): Promise<ActionResultMap[(typeof WEBMCP_TOOL_TO_ACTION)[N]]> {
  if (!isWebMcpToolName(toolName)) {
    throw new DomainError("invalid_input", `Unknown WebMCP tool ${toolName}`);
  }
  const request = await requestAuthFromIncoming();
  await requireOwnerIdFromRequest(request);
  return createBoundWebMcpRuntime({ request }).invoke(toolName, input);
}

/** Follow-up membership write. Not a registered tool. Same session path. */
export async function runSetCardFrameFromGeometry(
  card: Pick<Card, "id" | "position" | "size">,
  frames: ReadonlyArray<FrameContainmentCandidate>,
) {
  const request = await requestAuthFromIncoming();
  await requireOwnerIdFromRequest(request);
  return applyCardFrameFromGeometry(
    createSessionBoundExecute(request),
    card,
    frames,
  );
}
