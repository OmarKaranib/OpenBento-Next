"use client";

import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WatchBotCanvasPanel } from "@/components/shell/WatchBotManager";
import {
  configuredStatusDotClass,
  dominantConfiguredStatus,
  watchBotCountSummary,
} from "@/lib/domain/watchbot-ui";
import { cn } from "@/lib/utils";

export function WatchBotStatus() {
  const { snapshot } = useWorkspace();
  const { setRailPanel } = useWorkspaceUi();
  const summary = watchBotCountSummary(snapshot.watchBots);
  const dominant = dominantConfiguredStatus(snapshot.watchBots);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
        >
          {/* Color is configured WatchBot.status, not live worker proof. */}
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              configuredStatusDotClass(dominant),
            )}
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
