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
  InMemoryDomainAdapter,
  type ExecuteOptions,
  type SessionSnapshot,
} from "@/lib/domain/memory-adapter";

type WorkspaceContextValue = {
  adapter: InMemoryDomainAdapter;
  snapshot: SessionSnapshot;
  execute: <N extends ActionName>(
    name: N,
    input: ActionInputByName[N],
    options?: ExecuteOptions,
  ) => CatalogResult<N>;
  commit: (calls: CatalogCall[], options?: ExecuteOptions) => unknown[];
  undo: () => boolean;
  redo: () => boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo(() => new InMemoryDomainAdapter(), []);
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      adapter,
      snapshot,
      execute: (name, input, options) => adapter.execute(name, input, options),
      commit: (calls, options) => adapter.commit(calls, options),
      undo: () => adapter.undo(),
      redo: () => adapter.redo(),
    }),
    [adapter, snapshot],
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
