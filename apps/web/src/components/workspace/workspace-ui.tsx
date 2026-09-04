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
  watchBotCreateInstruction: string;
  setRailPanel: (panel: RailPanel) => void;
  toggleRailPanel: (panel: Exclude<RailPanel, null>) => void;
  setAgentOpen: (open: boolean) => void;
  setFrameToolActive: (active: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  openWatchBotCreate: (instruction?: string) => void;
};

const WorkspaceUiContext = createContext<WorkspaceUiValue | null>(null);

export function WorkspaceUiProvider({ children }: { children: ReactNode }) {
  const [railPanel, setRailPanel] = useState<RailPanel>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [frameToolActive, setFrameToolActive] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [watchBotCreateEpoch, setWatchBotCreateEpoch] = useState(0);
  const [watchBotCreateInstruction, setWatchBotCreateInstruction] = useState("");

  const toggleRailPanel = useCallback((panel: Exclude<RailPanel, null>) => {
    setRailPanel((current) => nextRailPanel(current, panel));
  }, []);

  const openWatchBotCreate = useCallback((instruction = "") => {
    setRailPanel("watchbots");
    setWatchBotCreateInstruction(instruction);
    setWatchBotCreateEpoch((current) => current + 1);
  }, []);

  const value = useMemo<WorkspaceUiValue>(
    () => ({
      railPanel,
      agentOpen,
      frameToolActive,
      snapToGrid,
      watchBotCreateEpoch,
      watchBotCreateInstruction,
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
      watchBotCreateInstruction,
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
