"use client";

import { CanvasRoot } from "@/components/canvas/CanvasRoot";
import { LeftRail } from "@/components/shell/LeftRail";
import { SidePanels } from "@/components/shell/SidePanels";
import { TopBar } from "@/components/shell/TopBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebMcpHost } from "@/webmcp/WebMcpHost";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceProvider";
import { WorkspaceUiProvider, useWorkspaceUi } from "./workspace-ui";
import { CanvasMonitorProvider } from "./canvas-monitor";
import { useCallback, useEffect, useRef } from "react";
import { shouldDeactivateWorkspaceView } from "@/lib/canvas/browser-fullscreen";

function WorkspaceChrome() {
  const { snapshot, execute } = useWorkspace();
  const { setWorkspaceElement, workspaceElement } = useWorkspaceUi();
  const fullscreen = Boolean(snapshot.fullscreen?.active);
  const activeFrameId = snapshot.fullscreen?.frameId;
  const fullscreenExitInFlight = useRef(false);
  const rootRef = useCallback((element: HTMLDivElement | null) => {
    setWorkspaceElement(element);
  }, [setWorkspaceElement]);

  useEffect(() => {
    function onFullscreenChange() {
      if (
        !fullscreenExitInFlight.current &&
        shouldDeactivateWorkspaceView(activeFrameId, document, workspaceElement)
      ) {
        fullscreenExitInFlight.current = true;
        void execute(
          "fullscreenFrame",
          { frameId: activeFrameId, active: false },
          { history: false },
        ).finally(() => {
          fullscreenExitInFlight.current = false;
        });
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [activeFrameId, execute, workspaceElement]);

  return (
    <div ref={rootRef} data-openbento-workspace className="relative flex h-full min-h-0 w-full overflow-hidden bg-[#0b0d10]">
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
