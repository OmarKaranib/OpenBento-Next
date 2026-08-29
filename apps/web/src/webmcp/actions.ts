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
import { createBoundWebMcpRuntime, createSessionBoundExecute } from "./bound-runtime";

/**
 * Server entry for `document.modelContext.registerTool` execute callbacks.
 * ownerId is resolved by `requireSessionOwnerId` inside `runBoundAction`.
 */
export async function runWebMcpTool<N extends WebMcpToolName>(
  toolName: N,
  input: unknown,
): Promise<ActionResultMap[(typeof WEBMCP_TOOL_TO_ACTION)[N]]> {
  if (!isWebMcpToolName(toolName)) {
    throw new DomainError("invalid_input", `Unknown WebMCP tool ${toolName}`);
  }
  return createBoundWebMcpRuntime().invoke(toolName, input);
}

/** Follow-up membership write. Not a registered tool. Same session path. */
export async function runSetCardFrameFromGeometry(
  card: Pick<Card, "id" | "position" | "size">,
  frames: ReadonlyArray<FrameContainmentCandidate>,
) {
  return applyCardFrameFromGeometry(createSessionBoundExecute(), card, frames);
}
