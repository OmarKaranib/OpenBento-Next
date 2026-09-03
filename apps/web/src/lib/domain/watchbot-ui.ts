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
import { sanitizeUntrustedDisplayText } from "../untrusted";

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
  "WatchBots monitor configured sources in the background. Activity and source availability depend on the selected sources.";

export const WATCHBOT_SCOPE_LABEL = "This Canvas";

export const WATCHBOT_SOURCE_TYPE_OPTIONS: ReadonlyArray<{
  value: WatchBotSourceType;
  label: string;
  note?: string;
}> = [
  { value: "web", label: "Web" },
  { value: "news", label: "News" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
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

export function watchBotCountSummary(
  watchBots: readonly Pick<WatchBot, "status">[],
): string {
  const count = watchBots.length;
  const running = watchBots.filter((bot) => bot.status === "running").length;
  const errors = watchBots.filter((bot) => bot.status === "error").length;
  const base = `${count} WatchBot${count === 1 ? "" : "s"}`;
  const parts = [base];
  if (running > 0) {
    parts.push(`${running} configured running`);
  }
  if (errors > 0) {
    parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(.*)$/;
const WATCHBOT_ERROR_DISPLAY_MAX = 240;

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Real UTC calendar date only — Date rollover (e.g. 2026-02-31) is invalid. */
function isValidUtcYmd(ymd: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Short UTC label from a WatchBot.lastActivityAt ISO string.
 * Date-only → YYYY-MM-DD. Datetime → YYYY-MM-DD HH:mm (UTC).
 * Missing/invalid → null. Never invents "now".
 */
export function formatWatchBotLastActivity(iso?: string): string | null {
  if (typeof iso !== "string") {
    return null;
  }
  const trimmed = iso.trim();
  if (!trimmed) {
    return null;
  }
  const match = ISO_DATE_PREFIX.exec(trimmed);
  if (!match) {
    return null;
  }
  const ymd = match[1];
  const rest = match[2];
  if (!isValidUtcYmd(ymd)) {
    return null;
  }
  if (rest === "") {
    return ymd;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }
  const date = new Date(parsed);
  const ymdUtc = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  return `${ymdUtc} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

/**
 * Compact plain-text lastError for product UI. Untrusted: sanitize only, never HTML.
 */
export function watchBotErrorDisplay(lastError?: string): string | null {
  const cleaned = sanitizeUntrustedDisplayText(
    lastError,
    WATCHBOT_ERROR_DISPLAY_MAX,
  );
  return cleaned.length > 0 ? cleaned : null;
}

/** Tailwind fill for the header indicator. Default zinc when no configured status. */
export function configuredStatusDotClass(
  status: WatchBotStatus | null | undefined,
): string {
  switch (status) {
    case "running":
      return "bg-emerald-500";
    case "paused":
      return "bg-amber-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-zinc-600";
  }
}

/**
 * Configured record status for the header dot — not live worker proof.
 * error > running > paused; empty/unknown → null (zinc).
 */
export function dominantConfiguredStatus(
  watchBots: readonly Pick<WatchBot, "status">[],
): WatchBotStatus | null {
  if (watchBots.some((bot) => bot.status === "error")) {
    return "error";
  }
  if (watchBots.some((bot) => bot.status === "running")) {
    return "running";
  }
  if (watchBots.some((bot) => bot.status === "paused")) {
    return "paused";
  }
  return null;
}

export function sourceTypesLabel(
  sourceTypes: readonly WatchBotSourceType[],
): string {
  if (sourceTypes.length === 0) {
    return "sources unset";
  }
  return sourceTypes.join(", ");
}
