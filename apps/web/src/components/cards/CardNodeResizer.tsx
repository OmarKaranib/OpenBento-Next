"use client";

import type { Card } from "@openbento/domain";
import { NodeResizer } from "@xyflow/react";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUiOptional } from "@/components/workspace/workspace-ui";
import { isNearDashboardBoundary } from "@/lib/canvas/dashboard-boundary";
import { primaryDashboardFrame } from "@/lib/canvas/dashboard-view";

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
  const { session, snapshot } = useWorkspace();
  const { persistCardGeometry } = useCanvasCommands();
  const workspaceUi = useWorkspaceUiOptional();
  const dashboard = snapshot.canvases && snapshot.frames
    ? primaryDashboardFrame(snapshot)?.bounds
    : null;

  return (
    <NodeResizer
      isVisible={selected}
      minWidth={minWidth}
      minHeight={minHeight}
      color="#818cf8"
      handleClassName="nodrag nopan !h-3 !w-3 !rounded-sm !border-2 !border-zinc-950 !bg-indigo-400"
      lineClassName="nodrag nopan !border-2 !border-indigo-400"
      onResizeStart={() => {
        workspaceUi?.setDashboardEdgeActive(false);
        session.beginInteraction();
      }}
      onResize={(_event, params) => {
        workspaceUi?.setDashboardEdgeActive(
          isNearDashboardBoundary(
            {
              position: { x: params.x, y: params.y },
              size: { width: params.width, height: params.height },
            },
            dashboard,
          ),
        );
      }}
      onResizeEnd={(_event, params) => {
        void persistCardGeometry(card, {
          position: { x: params.x, y: params.y },
          size: { width: params.width, height: params.height },
        }).finally(() => {
          workspaceUi?.setDashboardEdgeActive(false);
          void session.endInteraction();
        });
      }}
    />
  );
}
