"use client";

import { StickyNote } from "lucide-react";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { NOTE_DEFAULT_SIZE, buildCreateNoteCardInput } from "@/lib/domain/note-card";
import { findFreeCardPosition } from "@/lib/find-free-card-position";
import { AddSourceCards } from "./AddSourceCard";
import { CanvasSwitcher } from "./CanvasSwitcher";
import { WatchBotStatus } from "./WatchBotStatus";
import { AgentEntry } from "./AgentEntry";

export function TopBar() {
  const { snapshot } = useWorkspace();
  const { persistCreatedNote } = useCanvasCommands();
  const canvasId = snapshot.currentCanvasId;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-12 items-center justify-between px-3">
      <div className="pointer-events-auto flex items-center gap-1">
        <CanvasSwitcher />
        <span className="text-zinc-700">·</span>
        <WatchBotStatus />
        <button
          type="button"
          className="ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
          onClick={() => {
            if (!canvasId) return;
            void persistCreatedNote(
              buildCreateNoteCardInput({
                canvasId,
                text: "",
                position: findFreeCardPosition(snapshot.cards, NOTE_DEFAULT_SIZE),
              }),
            );
          }}
        >
          <StickyNote className="h-3.5 w-3.5" />
          Note
        </button>
        <AddSourceCards />
      </div>
      <div className="pointer-events-auto">
        <AgentEntry />
      </div>
    </header>
  );
}
