"use server";

import type {
  ActionInputMap,
  ActionName,
  ActionResultMap,
  Canvas,
  CreateCanvasInput,
  CreateCardInput,
  CreateFrameInput,
  CreateWatchBotInput,
  FullscreenFrameInput,
  GetCanvasStateInput,
  GetWatchBotStatusInput,
  MoveCardInput,
  MoveFrameInput,
  PauseWatchBotInput,
  RenameCanvasInput,
  ResizeCardInput,
  ResizeFrameInput,
  ResumeWatchBotInput,
  SetCardFrameInput,
  SwitchCanvasInput,
  UpdateCanvasViewportInput,
  UpdateCardInput,
  UpdateFrameInput,
  UpdateWatchBotInput,
} from "@openbento/domain";
import { cookies, headers } from "next/headers";
import { rewindIdsForOwner } from "./ids";
import { runDomainActionFromRequest } from "./run-action";
import {
  requireOwnerIdFromRequest,
  type RequestAuthContext,
} from "./session";
import { getDomainStore } from "./store";
import { getSupabaseAuthUser } from "./supabase";
import { resolveStockMarketData } from "./market-data";

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
 * Thin Next.js wrappers around the shared ACTION_CATALOG executor.
 * Session user is resolved from Supabase Auth getUser() / auth.uid().
 * ownerId is never taken from the client input.
 */
export async function runDomainAction<K extends ActionName>(
  name: K,
  input: ActionInputMap[K],
): Promise<ActionResultMap[K]> {
  return runDomainActionFromRequest(
    await requestAuthFromIncoming(),
    name,
    input,
  );
}

/** Fail closed unless Supabase Auth has a verified user. */
export async function requireAuthenticatedSession(): Promise<void> {
  await requireOwnerIdFromRequest(await requestAuthFromIncoming());
}

/** Reload/login restore — not a catalog action. */
export async function listOwnedCanvases(): Promise<Canvas[]> {
  const ownerId = await requireOwnerIdFromRequest(
    await requestAuthFromIncoming(),
  );
  return getDomainStore().listCanvasesByOwner(ownerId);
}

export async function currentAuthUserId(): Promise<string | null> {
  const user = await getSupabaseAuthUser();
  return user?.id ?? null;
}

export async function signOut(): Promise<void> {
  const { createServerSupabaseClient } = await import("./supabase");
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}

/**
 * Test/dev undo helper. Does not wipe the durable store and does not
 * fall back to InMemoryDomainStore.
 */
export async function resetLocalWorkspace(): Promise<void> {
  const ownerId = await requireOwnerIdFromRequest(
    await requestAuthFromIncoming(),
  );
  rewindIdsForOwner(ownerId);
}

export async function createCanvas(input: CreateCanvasInput) {
  return runDomainAction("createCanvas", input);
}

export async function renameCanvas(input: RenameCanvasInput) {
  return runDomainAction("renameCanvas", input);
}

export async function switchCanvas(input: SwitchCanvasInput) {
  return runDomainAction("switchCanvas", input);
}

export async function updateCanvasViewport(input: UpdateCanvasViewportInput) {
  return runDomainAction("updateCanvasViewport", input);
}

export async function createCard(input: CreateCardInput) {
  return runDomainAction("createCard", input);
}

export async function updateCard(input: UpdateCardInput) {
  return runDomainAction("updateCard", input);
}

export async function moveCard(input: MoveCardInput) {
  return runDomainAction("moveCard", input);
}

export async function resizeCard(input: ResizeCardInput) {
  return runDomainAction("resizeCard", input);
}

export async function setCardFrame(input: SetCardFrameInput) {
  return runDomainAction("setCardFrame", input);
}

export async function createFrame(input: CreateFrameInput) {
  return runDomainAction("createFrame", input);
}

export async function updateFrame(input: UpdateFrameInput) {
  return runDomainAction("updateFrame", input);
}

export async function moveFrame(input: MoveFrameInput) {
  return runDomainAction("moveFrame", input);
}

export async function resizeFrame(input: ResizeFrameInput) {
  return runDomainAction("resizeFrame", input);
}

export async function createWatchBot(input: CreateWatchBotInput) {
  return runDomainAction("createWatchBot", input);
}

export async function updateWatchBot(input: UpdateWatchBotInput) {
  return runDomainAction("updateWatchBot", input);
}

export async function pauseWatchBot(input: PauseWatchBotInput) {
  return runDomainAction("pauseWatchBot", input);
}

export async function resumeWatchBot(input: ResumeWatchBotInput) {
  return runDomainAction("resumeWatchBot", input);
}

export async function getCanvasState(input: GetCanvasStateInput) {
  return runDomainAction("getCanvasState", input);
}

export async function getWatchBotStatus(input: GetWatchBotStatusInput) {
  return runDomainAction("getWatchBotStatus", input);
}

/** Server-only quote resolution used once during Stock Card creation. */
export async function resolveStockQuote(symbol: string) {
  await requireAuthenticatedSession();
  return resolveStockMarketData(symbol);
}

export async function fullscreenFrame(input: FullscreenFrameInput) {
  return runDomainAction("fullscreenFrame", input);
}
