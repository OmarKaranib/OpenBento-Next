"use client";

import { CanvasRoot } from "@/components/canvas/CanvasRoot";
import { LeftRail } from "@/components/shell/LeftRail";
import { SidePanels } from "@/components/shell/SidePanels";
import { TopBar } from "@/components/shell/TopBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebMcpHost } from "@/webmcp/WebMcpHost";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceProvider";
import { WorkspaceUiProvider } from "./workspace-ui";
import { CanvasMonitorProvider } from "./canvas-monitor";

function WorkspaceChrome() {
  const { snapshot } = useWorkspace();
  const fullscreen = Boolean(snapshot.fullscreen?.active);

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-[#0b0d10]">
      {fullscreen ? null : <LeftRail />}
      <div className="relative min-w-0 flex-1">
        {fullscreen ? null : <TopBar />}
        <CanvasRoot />
      </div>
      {fullscreen ? null : <SidePanels />}
    </div>
  );
}

export function WorkspaceApp() {
  return (
    <TooltipProvider>
      <WorkspaceProvider>
        <WorkspaceUiProvider>
          <CanvasMonitorProvider>
            <WebMcpHost />
            <WorkspaceChrome />
          </CanvasMonitorProvider>
        </WorkspaceUiProvider>
      </WorkspaceProvider>
    </TooltipProvider>
  );
}
