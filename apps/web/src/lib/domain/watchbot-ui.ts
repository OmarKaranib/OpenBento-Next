/**
 * Current-Canvas WatchBot UI helpers.
 * Create/update/pause/resume go through workspace execute → ACTION_CATALOG only.
 */

import type {
  CreateWatchBotInput,
  PauseWatchBotInput,
  ResumeWatchBotInput,
  UpdateWatchBotInput,
  WatchBot,
  WatchBotSourceType,
  WatchBotStatus,
} from "@openbento/domain";
import { WATCHBOT_SOURCE_TYPES } from "@openbento/domain";

/** Phrases the product UI must not show — contradicted by live domain/WebMCP. */
export const STALE_WATCHBOT_UI_PHRASES = [
  "Persistent monitors arrive in a later phase.",
  "Account-wide WatchBots",
  "out of scope for Phase 1",
  "Global WatchBot management is out of scope",
] as const;

export const WATCHBOT_ZERO_STATE_COPY =
  "No WatchBots on this Canvas yet. Create one to configure a persistent monitor for this Canvas.";

export const WATCHBOT_EXECUTION_CAVEAT =
  "Status is the saved WatchBot record. Live background source processing needs the WatchBot worker, which is not deployed on this app. Live X is not activated.";

export const WATCHBOT_SCOPE_LABEL = "This Canvas";

export const WATCHBOT_SOURCE_TYPE_OPTIONS: ReadonlyArray<{
  value: WatchBotSourceType;
  label: string;
  note?: string;
}> = [
  { value: "web", label: "Web" },
  { value: "news", label: "News" },
  { value: "youtube", label: "YouTube" },
  {
    value: "x",
    label: "X",
    note: "Not activated — configuration only",
  },
];

/** Domain-permitted source types only (ACTION_CATALOG enum). */
export const PERMITTED_WATCHBOT_SOURCE_TYPES: readonly WatchBotSourceType[] =
  WATCHBOT_SOURCE_TYPES;

export const DEFAULT_CREATE_SOURCE_TYPES: readonly WatchBotSourceType[] = [
  "web",
  "news",
];

export function isPermittedWatchBotSourceType(
  value: string,
): value is WatchBotSourceType {
  return (WATCHBOT_SOURCE_TYPES as readonly string[]).includes(value);
}

export function buildCreateWatchBotInput(args: {
  canvasId: string;
  instruction: string;
  name?: string;
  sourceTypes?: readonly WatchBotSourceType[];
}): CreateWatchBotInput {
  const canvasId = args.canvasId.trim();
  const instruction = args.instruction.trim();
  if (!canvasId) {
    throw new Error("WatchBot requires a Canvas");
  }
  if (!instruction) {
    throw new Error("WatchBot instruction is required");
  }
  const name = args.name?.trim();
  const sourceTypes = (args.sourceTypes ?? DEFAULT_CREATE_SOURCE_TYPES).filter(
    isPermittedWatchBotSourceType,
  );
  const input: CreateWatchBotInput = {
    canvasId,
    instruction,
    sourceTypes: [...sourceTypes],
  };
  if (name) {
    input.name = name;
  }
  return input;
}

export function buildUpdateWatchBotInput(args: {
  watchBotId: string;
  instruction?: string;
  name?: string;
  sourceTypes?: readonly WatchBotSourceType[];
}): UpdateWatchBotInput {
  const watchBotId = args.watchBotId.trim();
  if (!watchBotId) {
    throw new Error("watchBotId is required");
  }
  const input: UpdateWatchBotInput = { watchBotId };
  if (args.instruction !== undefined) {
    const instruction = args.instruction.trim();
    if (!instruction) {
      throw new Error("WatchBot instruction is required");
    }
    input.instruction = instruction;
  }
  if (args.name !== undefined) {
    input.name = args.name.trim();
  }
  if (args.sourceTypes !== undefined) {
    input.sourceTypes = args.sourceTypes.filter(isPermittedWatchBotSourceType);
  }
  return input;
}

export function buildPauseWatchBotInput(watchBotId: string): PauseWatchBotInput {
  return { watchBotId };
}

export function buildResumeWatchBotInput(
  watchBotId: string,
): ResumeWatchBotInput {
  return { watchBotId };
}

/** Domain record status — not live worker activity. */
export function configuredStatusLabel(status: WatchBotStatus): string {
  switch (status) {
    case "running":
      return "configured · running";
    case "paused":
      return "configured · paused";
    case "error":
      return "configured · error";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function watchBotCountSummary(watchBots: readonly WatchBot[]): string {
  const count = watchBots.length;
  const running = watchBots.filter((bot) => bot.status === "running").length;
  const base = `${count} WatchBot${count === 1 ? "" : "s"}`;
  if (running === 0) {
    return base;
  }
  return `${base} · ${running} configured running`;
}

export function sourceTypesLabel(
  sourceTypes: readonly WatchBotSourceType[],
): string {
  if (sourceTypes.length === 0) {
    return "sources unset";
  }
  return sourceTypes.join(", ");
}
