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

/**
 * Keeps rail section behavior in one place so every trigger has the same
 * open, switch, and close semantics.
 */
export function nextRailPanel(
  current: RailPanel,
  requested: RailPanel,
): RailPanel {
  if (requested === null || current === requested) {
    return null;
  }

  return requested;
}

type WorkspaceUiValue = {
  railPanel: RailPanel;
  agentOpen: boolean;
  frameToolActive: boolean;
  snapToGrid: boolean;
  /** Incremented when the Canvas menu asks to open the existing create UI. */
  watchBotCreateEpoch: number;
  setRailPanel: (panel: RailPanel) => void;
  toggleRailPanel: (panel: Exclude<RailPanel, null>) => void;
  setAgentOpen: (open: boolean) => void;
  setFrameToolActive: (active: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  openWatchBotCreate: () => void;
};

const WorkspaceUiContext = createContext<WorkspaceUiValue | null>(null);

export function WorkspaceUiProvider({ children }: { children: ReactNode }) {
  const [railPanel, setRailPanel] = useState<RailPanel>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [frameToolActive, setFrameToolActive] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [watchBotCreateEpoch, setWatchBotCreateEpoch] = useState(0);

  const toggleRailPanel = useCallback((panel: Exclude<RailPanel, null>) => {
    setRailPanel((current) => nextRailPanel(current, panel));
  }, []);

  const openWatchBotCreate = useCallback(() => {
    setRailPanel("watchbots");
    setWatchBotCreateEpoch((current) => current + 1);
  }, []);

  const value = useMemo<WorkspaceUiValue>(
    () => ({
      railPanel,
      agentOpen,
      frameToolActive,
      snapToGrid,
      watchBotCreateEpoch,
      setRailPanel,
      toggleRailPanel,
      setAgentOpen,
      setFrameToolActive,
      setSnapToGrid,
      openWatchBotCreate,
    }),
    [
      railPanel,
      agentOpen,
      frameToolActive,
      snapToGrid,
      watchBotCreateEpoch,
      toggleRailPanel,
      openWatchBotCreate,
    ],
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
