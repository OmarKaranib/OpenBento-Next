"use client";

import type { Card } from "@openbento/domain";
import { NodeResizer } from "@xyflow/react";
import { useRef } from "react";
import { useCanvasCommands } from "@/components/canvas/use-canvas-commands";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUiOptional } from "@/components/workspace/workspace-ui";
import {
  cardDashboardActivity,
  clampDashboardResize,
  isDashboardGeometryInside,
  type DashboardGeometry,
} from "@/lib/canvas/dashboard-boundary";
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
  const resizeStartedInside = useRef(false);
  const resizeGeometry = useRef<DashboardGeometry | null>(null);
  const minimumSize = { width: minWidth, height: minHeight };
  const dashboardFrame = snapshot.canvases && snapshot.frames
    ? primaryDashboardFrame(snapshot)
    : null;
  const dashboard = dashboardFrame?.bounds ?? null;

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
        resizeStartedInside.current =
          cardDashboardActivity(card.frameId, dashboardFrame?.id ?? "") ??
          isDashboardGeometryInside(
            { position: card.position, size: card.size },
            dashboard,
          );
        resizeGeometry.current = null;
        session.beginInteraction();
      }}
      shouldResize={(_event, params) => {
        const desired = {
          position: { x: params.x, y: params.y },
          size: { width: params.width, height: params.height },
        };
        const constrained = resizeStartedInside.current
          ? clampDashboardResize(desired, dashboard, minimumSize)
          : desired;
        resizeGeometry.current = constrained;
        workspaceUi?.setDashboardEdgeActive(
          constrained.position.x !== desired.position.x ||
            constrained.position.y !== desired.position.y ||
            constrained.size.width !== desired.size.width ||
            constrained.size.height !== desired.size.height,
        );
        return constrained === desired;
      }}
      onResize={(_event, params) => {
        resizeGeometry.current = {
          position: { x: params.x, y: params.y },
          size: { width: params.width, height: params.height },
        };
      }}
      onResizeEnd={(_event, params) => {
        const geometry = resizeGeometry.current ?? {
          position: { x: params.x, y: params.y },
          size: { width: params.width, height: params.height },
        };
        void persistCardGeometry(card, {
          position: geometry.position,
          size: geometry.size,
        }).finally(() => {
          resizeGeometry.current = null;
          workspaceUi?.setDashboardEdgeActive(false);
          void session.endInteraction();
        });
      }}
    />
  );
}
