"use server";

import type {
  ActionInputMap,
  ActionName,
  ActionResultMap,
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
import { runBoundAction } from "./run-action";
import { requireSessionOwnerId } from "./session";
import { getDomainStore } from "./store";

/**
 * Thin Next.js wrappers around the shared ACTION_CATALOG executor.
 * Session user is resolved here. ownerId is never taken from the client input.
 */
export async function runDomainAction<K extends ActionName>(
  name: K,
  input: ActionInputMap[K],
): Promise<ActionResultMap[K]> {
  return runBoundAction(
    { getOwnerId: requireSessionOwnerId, store: getDomainStore() },
    name,
    input,
  );
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

export async function fullscreenFrame(input: FullscreenFrameInput) {
  return runDomainAction("fullscreenFrame", input);
}
