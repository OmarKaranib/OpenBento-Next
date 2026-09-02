"use client";

import { Check, Search, X } from "lucide-react";
import { MONITOR_TYPE_OPTIONS } from "@/lib/canvas/card-search";
import { useCanvasMonitor } from "@/components/workspace/canvas-monitor";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

  if (!snapshot.currentCanvasId) {
    return null;
  }

  const typeLabel =
    filter.types.length === 0
      ? "Type"
      : filter.types.length === 1
        ? (MONITOR_TYPE_OPTIONS.find((entry) => entry.type === filter.types[0])
            ?.label ?? "Type")
        : `${filter.types.length} types`;

  return (
    <div
      className="ml-2 flex items-center gap-1 rounded-md border border-zinc-800/80 bg-[#141820]/90 px-1.5 py-0.5"
      role="search"
      aria-label="Filter Cards on this Canvas"
    >
      <label className="flex min-w-0 items-center gap-1">
        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <input
          type="search"
          value={filter.query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Canvas"
          aria-label="Search Cards by title or note text"
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
          onClick={clearFilter}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
