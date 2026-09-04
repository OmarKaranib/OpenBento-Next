"use client";

import {
  LocateFixed,
  Maximize2,
  Minus,
  Plus,
  Redo2,
  Scan,
  Undo2,
  Grid3x3,
} from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useWorkspaceUi } from "@/components/workspace/workspace-ui";
import {
  dashboardFitRequest,
  dashboardFullscreenInput,
  primaryDashboardFrame,
} from "@/lib/canvas/dashboard-view";

const TOOLS = [
  { id: "zoom-in", label: "Zoom In", icon: Plus },
  { id: "zoom-out", label: "Zoom Out", icon: Minus },
  { id: "fit-dashboard", label: "Fit Dashboard", icon: Scan },
  { id: "return-dashboard", label: "Return to Dashboard", icon: LocateFixed },
  { id: "fullscreen-dashboard", label: "Fullscreen Dashboard", icon: Maximize2 },
  { id: "snap", label: "Snap/Grid", icon: Grid3x3 },
  { id: "undo", label: "Undo", icon: Undo2 },
  { id: "redo", label: "Redo", icon: Redo2 },
] as const;

export const CANVAS_VIEW_TOOL_IDS = TOOLS.map((tool) => tool.id);

export function CanvasToolbar() {
  const { zoomIn, zoomOut, fitBounds } = useReactFlow();
  const { snapshot, execute, undo, redo } = useWorkspace();
  const { snapToGrid, setSnapToGrid } = useWorkspaceUi();
  const frame = primaryDashboardFrame(snapshot);
  const fullscreenActive = Boolean(
    frame && snapshot.fullscreen?.active && snapshot.fullscreen.frameId === frame.id,
  );

  return (
    <div className="absolute bottom-4 left-3 z-20 flex flex-col gap-0.5 rounded-xl border border-[#2a3140] bg-[#141820]/95 p-1 shadow-xl backdrop-blur-sm">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const active =
          (tool.id === "snap" && snapToGrid) ||
          (tool.id === "fullscreen-dashboard" && fullscreenActive);
        const disabled =
          (tool.id === "undo" && !snapshot.canUndo) ||
          (tool.id === "redo" && !snapshot.canRedo) ||
          ((tool.id === "fit-dashboard" ||
            tool.id === "return-dashboard" ||
            tool.id === "fullscreen-dashboard") &&
            !frame);

        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="toolbar"
                size="icon"
                aria-label={tool.label}
                data-active={active}
                disabled={disabled}
                onClick={() => {
                  if (tool.id === "snap") setSnapToGrid(!snapToGrid);
                  if (tool.id === "zoom-in") void zoomIn({ duration: 160 });
                  if (tool.id === "zoom-out") void zoomOut({ duration: 160 });
                  if (frame && tool.id === "fit-dashboard") {
                    const request = dashboardFitRequest(frame, "fit");
                    void fitBounds(request.bounds, request.options);
                  }
                  if (frame && tool.id === "return-dashboard") {
                    const request = dashboardFitRequest(frame, "return");
                    void fitBounds(request.bounds, request.options);
                  }
                  if (frame && tool.id === "fullscreen-dashboard") {
                    void execute(
                      "fullscreenFrame",
                      dashboardFullscreenInput(frame, snapshot.fullscreen),
                      { history: false },
                    );
                  }
                  if (tool.id === "undo") void undo();
                  if (tool.id === "redo") void redo();
                }}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{tool.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
