"use client";

import { Sparkles } from "lucide-react";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import { cn } from "@/lib/utils";

export function AgentEntry() {
  const { agentOpen, setAgentOpen } = useWorkspaceUi();

  return (
    <button
      type="button"
      onClick={() => setAgentOpen(!agentOpen)}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800",
        agentOpen && "border-zinc-600 bg-zinc-800",
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
      Agent
    </button>
  );
}
