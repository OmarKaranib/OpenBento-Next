"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type RailPanel = "canvases" | "watchbots" | "settings" | null;

type WorkspaceUiValue = {
  railPanel: RailPanel;
  agentOpen: boolean;
  frameToolActive: boolean;
  snapToGrid: boolean;
  setRailPanel: (panel: RailPanel) => void;
  toggleRailPanel: (panel: Exclude<RailPanel, null>) => void;
  setAgentOpen: (open: boolean) => void;
  setFrameToolActive: (active: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
};

const WorkspaceUiContext = createContext<WorkspaceUiValue | null>(null);

export function WorkspaceUiProvider({ children }: { children: ReactNode }) {
  const [railPanel, setRailPanel] = useState<RailPanel>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [frameToolActive, setFrameToolActive] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);

  const toggleRailPanel = useCallback((panel: Exclude<RailPanel, null>) => {
    setRailPanel((current) => (current === panel ? null : panel));
  }, []);

  const value = useMemo<WorkspaceUiValue>(
    () => ({
      railPanel,
      agentOpen,
      frameToolActive,
      snapToGrid,
      setRailPanel,
      toggleRailPanel,
      setAgentOpen,
      setFrameToolActive,
      setSnapToGrid,
    }),
    [railPanel, agentOpen, frameToolActive, snapToGrid, toggleRailPanel],
  );

  return (
    <WorkspaceUiContext.Provider value={value}>
      {children}
    </WorkspaceUiContext.Provider>
  );
}

export function useWorkspaceUi(): WorkspaceUiValue {
  const value = useContext(WorkspaceUiContext);
  if (!value) {
    throw new Error("useWorkspaceUi must be used within WorkspaceUiProvider");
  }
  return value;
}
