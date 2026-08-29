"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ActionName } from "@openbento/domain";
import type { ActionInputByName, CatalogCall, CatalogResult } from "@/lib/domain/inputs";
import {
  WorkspaceSession,
  type ExecuteOptions,
  type SessionSnapshot,
} from "@/lib/domain/workspace-session";

type WorkspaceContextValue = {
  session: WorkspaceSession;
  snapshot: SessionSnapshot;
  execute: <N extends ActionName>(
    name: N,
    input: ActionInputByName[N],
    options?: ExecuteOptions,
  ) => Promise<CatalogResult<N>>;
  commit: (calls: CatalogCall[], options?: ExecuteOptions) => Promise<unknown[]>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const session = useMemo(() => new WorkspaceSession(), []);
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      session,
      snapshot,
      execute: (name, input, options) => session.execute(name, input, options),
      commit: (calls, options) => session.commit(calls, options),
      undo: () => session.undo(),
      redo: () => session.redo(),
    }),
    [session, snapshot],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return value;
}
