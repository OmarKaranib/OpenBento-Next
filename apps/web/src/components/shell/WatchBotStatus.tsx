"use client";

import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WatchBotCanvasPanel } from "@/components/shell/WatchBotManager";
import { watchBotCountSummary } from "@/lib/domain/watchbot-ui";

export function WatchBotStatus() {
  const { snapshot } = useWorkspace();
  const { setRailPanel } = useWorkspaceUi();
  const summary = watchBotCountSummary(snapshot.watchBots);
  const hasRunning = snapshot.watchBots.some((bot) => bot.status === "running");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
        >
          <span
            className={
              hasRunning
                ? "h-1.5 w-1.5 rounded-full bg-emerald-600"
                : "h-1.5 w-1.5 rounded-full bg-zinc-600"
            }
            aria-hidden
          />
          <span>{summary}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <WatchBotCanvasPanel
          showManageLink
          onOpenManage={() => setRailPanel("watchbots")}
        />
      </PopoverContent>
    </Popover>
  );
}
