"use client";

import {
  Columns3,
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

const TOOLS = [
  { id: "snap", label: "Snap to grid", icon: Grid3x3 },
  { id: "zoom-in", label: "Zoom in", icon: Plus },
  { id: "zoom-out", label: "Zoom out", icon: Minus },
  { id: "fit", label: "Fit", icon: Scan },
  { id: "column", label: "Add Column", icon: Columns3 },
  { id: "undo", label: "Undo", icon: Undo2 },
  { id: "redo", label: "Redo", icon: Redo2 },
] as const;

export function CanvasToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { snapshot, execute, undo, redo } = useWorkspace();
  const { snapToGrid, setSnapToGrid } = useWorkspaceUi();

  return (
    <div className="absolute bottom-4 left-3 z-20 flex flex-col gap-0.5 rounded-xl border border-[#2a3140] bg-[#141820]/95 p-1 shadow-xl backdrop-blur-sm">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const active =
          tool.id === "snap" && snapToGrid;
        const disabled =
          (tool.id === "undo" && !snapshot.canUndo) ||
          (tool.id === "redo" && !snapshot.canRedo);

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
                  if (tool.id === "fit") void fitView({ padding: 0.2, duration: 200 });
                  if (tool.id === "column" && snapshot.currentCanvasId) {
                    void execute("createColumn", {
                      canvasId: snapshot.currentCanvasId,
                    });
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
