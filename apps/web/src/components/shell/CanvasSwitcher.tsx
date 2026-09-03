"use client";

import type { Canvas } from "@openbento/domain";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
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

export function DeleteCanvasDialog({
  canvas,
  deleting,
  onCancel,
  onConfirm,
}: {
  canvas: Pick<Canvas, "id" | "name">;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
      role="presentation"
    >
      <div
        aria-labelledby="delete-canvas-title"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-[#141820] p-5 shadow-2xl"
        role="dialog"
      >
        <h2
          id="delete-canvas-title"
          className="text-base font-semibold text-zinc-100"
        >
          Delete “{canvas.name}”?
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          This permanently deletes its Cards, Frames and WatchBots.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-500"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "Deleting…" : "Delete Canvas"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CanvasSwitcher() {
  const { snapshot, execute } = useWorkspace();
  const current = snapshot.canvases.find(
    (canvas) => canvas.id === snapshot.currentCanvasId,
  );
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(current?.name ?? "");
  const [deleteCandidate, setDeleteCandidate] = useState<Pick<
    Canvas,
    "id" | "name"
  > | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!current) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-500">OpenBento / —</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void execute("createCanvas", { name: "Untitled" });
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Canvas
        </Button>
      </div>
    );
  }

  return (
    <>
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
            <span className="truncate font-medium text-zinc-100">
              {current.name}
            </span>
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
                  void execute(
                    "switchCanvas",
                    { canvasId: canvas.id },
                    { history: false },
                  );
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
                  void execute("renameCanvas", {
                    canvasId: current.id,
                    name: next,
                  });
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-400 focus:bg-red-950/50 focus:text-red-300"
            onSelect={() => {
              setDeleteCandidate({ id: current.id, name: current.name });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Canvas
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {deleteCandidate ? (
        <DeleteCanvasDialog
          canvas={deleteCandidate}
          deleting={deleting}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={() => {
            setDeleting(true);
            void execute(
              "deleteCanvas",
              { canvasId: deleteCandidate.id },
              { history: false },
            )
              .then(() => setDeleteCandidate(null))
              .finally(() => setDeleting(false));
          }}
        />
      ) : null}
    </>
  );
}
