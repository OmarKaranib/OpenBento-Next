"use client";

import { StickyNote } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { buildCreateNoteCardInput } from "@/lib/domain/note-card";
import { CanvasSwitcher } from "./CanvasSwitcher";
import { WatchBotStatus } from "./WatchBotStatus";
import { AgentEntry } from "./AgentEntry";

export function TopBar() {
  const { snapshot, execute } = useWorkspace();
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
            execute(
              "createCard",
              buildCreateNoteCardInput({
                canvasId,
                text: "",
                position: {
                  x: 80 + snapshot.cards.length * 24,
                  y: 80 + snapshot.cards.length * 16,
                },
              }),
            );
          }}
        >
          <StickyNote className="h-3.5 w-3.5" />
          Note
        </button>
      </div>
      <div className="pointer-events-auto">
        <AgentEntry />
      </div>
    </header>
  );
}
