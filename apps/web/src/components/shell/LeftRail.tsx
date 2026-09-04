"use client";

import { LayoutGrid, Radio, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceUi, type RailPanel } from "@/components/workspace/workspace-ui";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OpenBentoMark } from "./OpenBentoMark";

const NAV: Array<{
  id: Exclude<RailPanel, null>;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: "canvases", label: "Canvases", icon: LayoutGrid },
  { id: "watchbots", label: "WatchBots", icon: Radio },
  { id: "settings", label: "Settings", icon: Settings },
];

export function LeftRail() {
  const { railPanel, toggleRailPanel } = useWorkspaceUi();

  return (
    <aside className="relative z-40 flex h-full w-14 shrink-0 flex-col border-r border-[#262d38] bg-[#11141a]">
      <div className="flex h-12 items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center" aria-label="OpenBento">
              <OpenBentoMark />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">OpenBento</TooltipContent>
        </Tooltip>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1 pt-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = railPanel === item.id;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={item.label}
                  aria-pressed={active}
                  onClick={() => toggleRailPanel(item.id)}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-150 motion-reduce:transition-none hover:bg-[#1a1f27] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#11141a]",
                    active &&
                      "bg-[#1d2430] text-zinc-50 shadow-[inset_0_0_0_1px_rgba(101,116,139,0.32)] before:absolute before:-left-2 before:h-5 before:w-0.5 before:rounded-r before:bg-indigo-300/80",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="flex items-center justify-center pb-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Account and settings"
              aria-pressed={railPanel === "settings"}
              onClick={() => toggleRailPanel("settings")}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors duration-150 motion-reduce:transition-none hover:border-zinc-500 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#11141a]",
                railPanel === "settings" &&
                  "border-zinc-500 bg-[#1d2430] text-zinc-50 before:absolute before:-left-3.5 before:h-5 before:w-0.5 before:rounded-r before:bg-indigo-300/80",
              )}
            >
              <User className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Account &amp; settings</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
