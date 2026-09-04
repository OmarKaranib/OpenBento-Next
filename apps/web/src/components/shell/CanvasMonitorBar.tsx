"use client";

import { Check, CornerDownLeft, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MONITOR_TYPE_OPTIONS } from "@/lib/canvas/card-search";
import { ADD_CATALOG, type AddCatalogEntry } from "@/lib/add-catalog";
import { parseAddCommand } from "@/lib/add-command";
import { dashboardFreeCardPosition } from "@/lib/canvas/dashboard-card-placement";
import { buildCreateNoteCardInput } from "@/lib/domain/note-card";
import { getCardType } from "@/components/cards/registry";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";
import { AddCardForm } from "@/components/shell/AddMenu";
import { useCanvasMonitor } from "@/components/workspace/canvas-monitor";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LAST_VISIT_HINT =
  "New since last visit in this browser. Not synced to the server.";

export function CanvasMonitorBar() {
  const { snapshot } = useWorkspace();
  const {
    filter,
    setQuery,
    toggleType,
    setNewOnly,
    clearFilter,
    isFiltered,
    newCount,
    markSeen,
  } = useCanvasMonitor();
  const { persistCreatedNote, persistCreatedColumn } = useCanvasCommands();
  const { openWatchBotCreate } = useWorkspaceUi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(filter.query);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ target: "youtube" | "web" | "article" | "stock"; initial?: string } | null>(null);
  const commandMode = value.startsWith("/");
  const suggestions = useMemo(
    () => ADD_CATALOG.filter((entry) => entry.id !== "article"),
    [],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const typingElsewhere = Boolean(target && (tag === "input" || tag === "textarea" || target.isContentEditable) && target !== inputRef.current);
      if (typingElsewhere) return;
      if (event.key === "/" && target !== inputRef.current) {
        event.preventDefault(); setValue("/"); setQuery(""); setActiveSuggestion(0); inputRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setQuery]);

  async function runEntry(entry: AddCatalogEntry, initial?: string) {
    const canvasId = snapshot.currentCanvasId;
    if (!canvasId) return;
    setError(null);
    try {
      if (entry.creationMode === "note") {
        const type = getCardType("note")!;
        await persistCreatedNote(buildCreateNoteCardInput({ canvasId, text: "", position: dashboardFreeCardPosition(snapshot, type.defaultSize), size: type.defaultSize }));
      } else if (entry.creationMode === "column") {
        await persistCreatedColumn(canvasId, undefined, initial);
      } else if (entry.creationMode === "watchbot") {
        openWatchBotCreate(initial);
      } else {
        setForm({ target: entry.id as "youtube" | "web" | "article" | "stock", ...(initial ? { initial } : {}) });
      }
      setValue(""); setQuery("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not run command"); }
  }

  function executeCommand() {
    const parsed = parseAddCommand(value);
    if (!parsed) return;
    if (parsed.kind === "error") { setError(parsed.message); return; }
    if (parsed.kind === "select") { void runEntry(ADD_CATALOG.find((entry) => entry.id === parsed.id)!); return; }
    if (parsed.kind === "column") { void runEntry(ADD_CATALOG[0], parsed.name); return; }
    if (parsed.kind === "watchbot") { void runEntry(ADD_CATALOG[1], parsed.instruction); return; }
    if (parsed.kind === "source") { void runEntry(ADD_CATALOG.find((entry) => entry.id === parsed.id)!, parsed.url); return; }
    void runEntry(ADD_CATALOG.find((entry) => entry.id === "stock")!, parsed.symbol);
  }

  if (!snapshot.currentCanvasId) return null;

  const typeLabel =
    filter.types.length === 0
      ? "Type"
      : filter.types.length === 1
        ? (MONITOR_TYPE_OPTIONS.find((entry) => entry.type === filter.types[0])
            ?.label ?? "Type")
        : `${filter.types.length} types`;

  return (
    <div
      className="relative flex items-center gap-1 rounded-md border border-zinc-800/80 bg-[#141820]/90 px-1.5 py-0.5"
      role="search"
      aria-label="Filter Cards on this Canvas"
    >
      <label className="flex min-w-0 items-center gap-1">
        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            setValue(next); setError(null); setActiveSuggestion(0);
            setQuery(next.startsWith("/") ? "" : next);
          }}
          onKeyDown={(event) => {
            if (!commandMode) return;
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveSuggestion((current) => (current + 1) % suggestions.length); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length); }
            if (event.key === "Escape") { event.preventDefault(); setValue(""); setQuery(""); setError(null); }
            if (event.key === "Enter") { event.preventDefault(); if (value === "/") void runEntry(suggestions[activeSuggestion]); else executeCommand(); }
          }}
          placeholder="Search or command…"
          aria-label="Search Cards or run a command"
          className="h-6 w-32 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none sm:w-40"
        />
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-6 rounded px-1.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
              filter.types.length > 0 && "bg-zinc-800 text-zinc-200",
            )}
            aria-label="Filter by Card type"
          >
            {typeLabel}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>Card type</DropdownMenuLabel>
          {MONITOR_TYPE_OPTIONS.map((entry) => {
            const selected = filter.types.includes(entry.type);
            return (
              <DropdownMenuItem
                key={entry.type}
                onSelect={(event) => {
                  event.preventDefault();
                  toggleType(entry.type);
                }}
              >
                <span className="flex-1">{entry.label}</span>
                {selected ? <Check className="h-3.5 w-3.5 text-zinc-400" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        className={cn(
          "h-6 rounded px-1.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
          filter.newOnly && "bg-indigo-500/15 text-indigo-200",
        )}
        title={LAST_VISIT_HINT}
        aria-pressed={filter.newOnly}
        aria-label="Show only Cards new since last visit in this browser"
        onClick={() => setNewOnly(!filter.newOnly)}
      >
        New{newCount > 0 ? ` ${newCount}` : ""}
      </button>
      {newCount > 0 ? (
        <button
          type="button"
          className="h-6 rounded px-1.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          title="Clears New on this Canvas in this browser. Not synced."
          onClick={() => {
            markSeen();
            if (filter.newOnly) {
              setNewOnly(false);
            }
          }}
        >
          Mark seen
        </button>
      ) : null}
      {isFiltered ? (
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Clear search and filters"
          onClick={() => { clearFilter(); setValue(""); setError(null); }}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
      {commandMode ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-40 w-80 rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Commands</p>
          {suggestions.map((entry, index) => { const Icon = entry.icon; return <button key={entry.id} type="button" className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", activeSuggestion === index && "bg-zinc-800")} onMouseEnter={() => setActiveSuggestion(index)} onMouseDown={(event) => { event.preventDefault(); void runEntry(entry); }}><Icon className="h-3.5 w-3.5 text-zinc-400" /><span className="min-w-0 flex-1"><span className="block text-xs text-zinc-200">{entry.slashCommand} <span className="text-zinc-500">{entry.label}</span></span><span className="block truncate text-[10px] text-zinc-500">{entry.description}</span></span>{activeSuggestion === index ? <CornerDownLeft className="h-3.5 w-3.5 text-zinc-500" /> : null}</button>; })}
          {error ? <p className="px-2 pb-1 pt-1 text-[11px] text-red-400" role="alert">{error}</p> : null}
        </div>
      ) : error ? <p className="absolute left-0 top-[calc(100%+0.5rem)] z-40 whitespace-nowrap rounded-md border border-red-900/70 bg-zinc-950 px-2 py-1 text-[11px] text-red-400" role="alert">{error}</p> : null}
      <AddCardForm form={form} onClose={() => setForm(null)} />
    </div>
  );
}
