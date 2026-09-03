"use client";

import { useState, type FormEvent } from "react";
import type { WatchBot, WatchBotSourceType } from "@openbento/domain";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildCreateWatchBotInput,
  buildPauseWatchBotInput,
  buildResumeWatchBotInput,
  buildUpdateWatchBotInput,
  configuredStatusLabel,
  DEFAULT_CREATE_SOURCE_TYPES,
  formatWatchBotLastActivity,
  sourceTypesLabel,
  watchBotErrorDisplay,
  WATCHBOT_EXECUTION_CAVEAT,
  WATCHBOT_SCOPE_LABEL,
  WATCHBOT_SOURCE_TYPE_OPTIONS,
  WATCHBOT_ZERO_STATE_COPY,
} from "@/lib/domain/watchbot-ui";
import { watchBotCanvasActivity } from "@/lib/canvas/watchbot-attribution";
import { cn } from "@/lib/utils";

type Mode = "list" | "create" | "edit";

export function WatchBotCanvasPanel({
  onOpenManage,
  showManageLink = false,
  className,
}: {
  onOpenManage?: () => void;
  showManageLink?: boolean;
  className?: string;
}) {
  const { snapshot, execute } = useWorkspace();
  const { watchBotCreateEpoch } = useWorkspaceUi();
  const canvasId = snapshot.currentCanvasId;
  const watchBots = snapshot.watchBots;
  const cards = snapshot.cards;
  const [mode, setMode] = useState<Mode>("list");
  const [editing, setEditing] = useState<WatchBot | null>(null);
  const [name, setName] = useState("");
  const [instruction, setInstruction] = useState("");
  const [sourceTypes, setSourceTypes] = useState<WatchBotSourceType[]>([
    ...DEFAULT_CREATE_SOURCE_TYPES,
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetForm() {
    setName("");
    setInstruction("");
    setSourceTypes([...DEFAULT_CREATE_SOURCE_TYPES]);
    setError(null);
    setEditing(null);
    setMode("list");
  }

  const [seenCreateEpoch, setSeenCreateEpoch] = useState(0);
  if (watchBotCreateEpoch > seenCreateEpoch) {
    setSeenCreateEpoch(watchBotCreateEpoch);
    setName("");
    setInstruction("");
    setSourceTypes([...DEFAULT_CREATE_SOURCE_TYPES]);
    setError(null);
    setEditing(null);
    setMode("create");
  }

  function startCreate() {
    setName("");
    setInstruction("");
    setSourceTypes([...DEFAULT_CREATE_SOURCE_TYPES]);
    setError(null);
    setEditing(null);
    setMode("create");
  }

  function startEdit(bot: WatchBot) {
    setEditing(bot);
    setName(bot.name ?? "");
    setInstruction(bot.instruction);
    setSourceTypes(
      bot.sourceTypes.length > 0
        ? [...bot.sourceTypes]
        : [...DEFAULT_CREATE_SOURCE_TYPES],
    );
    setError(null);
    setMode("edit");
  }

  function toggleSource(value: WatchBotSourceType) {
    setSourceTypes((prev) =>
      prev.includes(value)
        ? prev.filter((entry) => entry !== value)
        : [...prev, value],
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canvasId) {
      setError("Create a Canvas first");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (mode === "create") {
        const input = buildCreateWatchBotInput({
          canvasId,
          name,
          instruction,
          sourceTypes,
        });
        await execute("createWatchBot", input);
      } else if (mode === "edit" && editing) {
        const input = buildUpdateWatchBotInput({
          watchBotId: editing.id,
          name,
          instruction,
          sourceTypes,
        });
        await execute("updateWatchBot", input);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "WatchBot action failed");
    } finally {
      setPending(false);
    }
  }

  async function onPause(watchBotId: string) {
    setPending(true);
    setError(null);
    try {
      await execute("pauseWatchBot", buildPauseWatchBotInput(watchBotId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setPending(false);
    }
  }

  async function onResume(watchBotId: string) {
    setPending(true);
    setError(null);
    try {
      await execute("resumeWatchBot", buildResumeWatchBotInput(watchBotId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setPending(false);
    }
  }

  if (mode === "create" || mode === "edit") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <p className="text-xs font-medium text-zinc-200">
          {mode === "create" ? "New WatchBot" : "Edit WatchBot"}
        </p>
        <p className="text-[11px] leading-4 text-zinc-500">
          {WATCHBOT_SCOPE_LABEL} · monitor configured sources
        </p>
        <form className="flex flex-col gap-2" onSubmit={(e) => void onSubmit(e)}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            aria-label="WatchBot name"
            disabled={pending}
          />
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Instruction"
            aria-label="WatchBot instruction"
            required
            disabled={pending}
            rows={3}
            className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950/70 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          />
          <fieldset className="space-y-1">
            <legend className="text-[11px] font-medium text-zinc-400">
              Preferred sources
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {WATCHBOT_SOURCE_TYPE_OPTIONS.map((option) => {
                const checked = sourceTypes.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
                      checked
                        ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-700",
                    )}
                    title={option.note}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={pending}
                      onChange={() => toggleSource(option.value)}
                    />
                    {option.label}
                    {option.note ? (
                      <span className="ml-0.5 text-[9px] text-zinc-500">
                        *
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            {WATCHBOT_SOURCE_TYPE_OPTIONS.filter((o) => o.note).map((o) => (
              <p key={o.value} className="text-[10px] leading-4 text-zinc-500">
                * {o.note}
              </p>
            ))}
            <p className="text-[10px] leading-4 text-zinc-600">
              Activity and source availability depend on the selected sources.
            </p>
          </fieldset>
          {error ? (
            <p className="text-[11px] text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-1">
            <Button type="submit" size="sm" disabled={pending || !canvasId}>
              {mode === "create" ? "Create" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={resetForm}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs font-medium text-zinc-200">{WATCHBOT_SCOPE_LABEL}</p>
      {watchBots.length === 0 ? (
        <p className="text-xs leading-5 text-zinc-500">{WATCHBOT_ZERO_STATE_COPY}</p>
      ) : (
        <ul className="space-y-2">
          {watchBots.map((bot) => {
            const lastActivity = formatWatchBotLastActivity(bot.lastActivityAt);
            const errorDisplay = watchBotErrorDisplay(bot.lastError);
            const activity = watchBotCanvasActivity(cards, bot.id, canvasId);
            return (
              <li
                key={bot.id}
                className="rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-200">
                      {bot.name?.trim() || "WatchBot"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {configuredStatusLabel(bot.status)}
                      {" · "}
                      {sourceTypesLabel(bot.sourceTypes)}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">
                      {activity.countLabel}
                    </p>
                    {activity.latestTitle ? (
                      <p className="mt-0.5 truncate text-[10px] leading-4 text-zinc-500">
                        Latest: <UntrustedText value={activity.latestTitle} />
                      </p>
                    ) : null}
                    {lastActivity ? (
                      <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">
                        Last activity {lastActivity}
                      </p>
                    ) : null}
                    {errorDisplay ? (
                      <p
                        className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-red-400"
                        role="status"
                      >
                        {errorDisplay}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                      bot.status === "running"
                        ? "bg-emerald-950 text-emerald-400"
                        : bot.status === "paused"
                          ? "bg-amber-950 text-amber-400"
                          : "bg-red-950 text-red-400",
                    )}
                  >
                    {bot.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-500">
                  {bot.instruction}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {bot.status === "paused" ? (
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
                      disabled={pending}
                      onClick={() => void onResume(bot.id)}
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
                      disabled={pending}
                      onClick={() => void onPause(bot.id)}
                    >
                      Pause
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
                    disabled={pending}
                    onClick={() => startEdit(bot)}
                  >
                    Edit
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[10px] leading-4 text-zinc-600">{WATCHBOT_EXECUTION_CAVEAT}</p>
      {error ? (
        <p className="text-[11px] text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        {showManageLink && onOpenManage ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={onOpenManage}
          >
            Manage WatchBots
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800"
          disabled={!canvasId || pending}
          onClick={startCreate}
        >
          + New WatchBot
        </button>
      </div>
    </div>
  );
}
