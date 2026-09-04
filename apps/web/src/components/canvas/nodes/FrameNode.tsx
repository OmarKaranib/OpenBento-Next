"use client";

import { type Node, type NodeProps } from "@xyflow/react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { cn } from "@/lib/utils";

export type FrameNode = Node<{ frameId: string }, "frame">;

export function FrameNode({ data }: NodeProps<FrameNode>) {
  const { snapshot } = useWorkspace();
  const frame = snapshot.frames.find((entry) => entry.id === data.frameId);

  if (!frame) {
    return null;
  }

  return (
    <div
      data-dashboard-surface
      className={cn(
        "openbento-dashboard-surface relative h-full w-full border border-[#3b4658] bg-[#11161f]/35 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_0_32px_rgba(0,0,0,0.24)]",
        snapshot.fullscreen?.active && "border-transparent bg-transparent shadow-none",
      )}
    />
  );
}
