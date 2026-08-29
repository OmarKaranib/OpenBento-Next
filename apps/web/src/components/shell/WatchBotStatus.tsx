"use client";

import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function WatchBotStatus() {
  const { snapshot } = useWorkspace();
  const { setRailPanel } = useWorkspaceUi();
  const count = snapshot.watchBots.length;
  const running = snapshot.watchBots.filter((bot) => bot.status === "running").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-zinc-600"
            aria-hidden
          />
          <span>
            {count} WatchBot{count === 1 ? "" : "s"}
            {running > 0 ? ` · ${running} running` : ""}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-xs font-medium text-zinc-200">This Canvas</p>
        {count === 0 ? (
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            No WatchBots on this Canvas yet. Persistent monitors arrive in a
            later phase.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {snapshot.watchBots.map((bot) => (
              <li key={bot.id} className="text-xs text-zinc-300">
                <span className="font-medium">{bot.name ?? "WatchBot"}</span>
                <span className="text-zinc-500"> — {bot.status}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col gap-1">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={() => setRailPanel("watchbots")}
          >
            Manage WatchBots
          </button>
          <button
            type="button"
            disabled
            className="rounded-md px-2 py-1 text-left text-xs text-zinc-600"
          >
            + New WatchBot
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
