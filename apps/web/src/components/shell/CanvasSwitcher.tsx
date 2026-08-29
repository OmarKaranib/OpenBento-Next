"use client";

import { Check, ChevronDown, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function CanvasSwitcher() {
  const { snapshot, execute } = useWorkspace();
  const current = snapshot.canvases.find(
    (canvas) => canvas.id === snapshot.currentCanvasId,
  );
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(current?.name ?? "");

  if (!current) {
    return (
      <span className="text-sm text-zinc-500">OpenBento / —</span>
    );
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          setRenaming(false);
          setName(current.name);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex max-w-xs items-center gap-1 rounded-md px-1.5 py-1 text-sm text-zinc-200 hover:bg-zinc-800/80"
        >
          <span className="text-zinc-500">OpenBento</span>
          <span className="text-zinc-600">/</span>
          <span className="truncate font-medium text-zinc-100">{current.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Canvas</DropdownMenuLabel>
        {snapshot.canvases.map((canvas) => (
          <DropdownMenuItem
            key={canvas.id}
            onSelect={() => {
              if (canvas.id !== current.id) {
                void execute("switchCanvas", { canvasId: canvas.id }, { history: false });
              }
            }}
          >
            <span className="flex-1 truncate">{canvas.name}</span>
            {canvas.id === current.id ? (
              <Check className="h-3.5 w-3.5 text-zinc-400" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {renaming ? (
          <form
            className="flex gap-1 px-1 pb-1"
            onSubmit={(event) => {
              event.preventDefault();
              const next = name.trim();
              if (next) {
                void execute("renameCanvas", { canvasId: current.id, name: next });
                setRenaming(false);
              }
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              aria-label="Canvas name"
            />
            <Button type="submit" size="sm">
              Save
            </Button>
          </form>
        ) : (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setRenaming(true);
              setName(current.name);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            void execute("createCanvas", { name: "Untitled" });
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Canvas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
