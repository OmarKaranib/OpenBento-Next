"use client";

import type { Card } from "@openbento/domain";
import { NodeResizer } from "@xyflow/react";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

export function CardNodeResizer({
  card,
  selected,
  minWidth,
  minHeight,
}: {
  card: Card;
  selected: boolean;
  minWidth: number;
  minHeight: number;
}) {
  const { session } = useWorkspace();
  const { persistCardGeometry } = useCanvasCommands();

  return (
    <NodeResizer
      isVisible={selected}
      minWidth={minWidth}
      minHeight={minHeight}
      color="#818cf8"
      handleClassName="nodrag nopan !h-3 !w-3 !rounded-sm !border-2 !border-zinc-950 !bg-indigo-400"
      lineClassName="nodrag nopan !border-2 !border-indigo-400"
      onResizeStart={() => {
        session.beginInteraction();
      }}
      onResizeEnd={(_event, params) => {
        void persistCardGeometry(card, {
          position: { x: params.x, y: params.y },
          size: { width: params.width, height: params.height },
        }).finally(() => {
          void session.endInteraction();
        });
      }}
    />
  );
}
