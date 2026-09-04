"use client";

import { CanvasMonitorBar } from "./CanvasMonitorBar";
import { CanvasSwitcher } from "./CanvasSwitcher";
import { WatchBotStatus } from "./WatchBotStatus";
import { AgentEntry } from "./AgentEntry";
import { AddMenu } from "./AddMenu";

export function TopBar() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-12 items-center justify-between px-3">
      <div className="pointer-events-auto flex min-w-0 items-center gap-1">
        <CanvasSwitcher />
        <span className="text-zinc-700">·</span>
        <WatchBotStatus />
      </div>
      <div className="pointer-events-auto flex min-w-0 items-center gap-2">
        <CanvasMonitorBar />
        <AddMenu />
        <AgentEntry />
      </div>
    </header>
  );
}
