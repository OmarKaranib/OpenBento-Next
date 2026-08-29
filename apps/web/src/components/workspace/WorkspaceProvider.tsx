"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
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
import {
  listOwnedCanvases,
  requireAuthenticatedSession,
  resetLocalWorkspace,
  runDomainAction,
} from "@/server/actions";
import { createBrowserSupabaseClient } from "@/server/supabase-browser";
import { LoginForm } from "@/components/auth/LoginForm";

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

let browserSession: WorkspaceSession | undefined;

function getBrowserWorkspaceSession(): WorkspaceSession {
  if (!browserSession) {
    browserSession = new WorkspaceSession({
      runAction: runDomainAction,
      resetStore: resetLocalWorkspace,
      prepare: requireAuthenticatedSession,
      restoreCanvases: listOwnedCanvases,
      replayOnReset: false,
    });
  }
  return browserSession;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<"loading" | "signed-out" | "signed-in">(
    "loading",
  );
  const session = useMemo(() => getBrowserWorkspaceSession(), []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    void supabase.auth.getUser().then(({ data }) => {
      setAuth(data.user ? "signed-in" : "signed-out");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setAuth(next?.user ? "signed-in" : "signed-out");
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (auth === "signed-in") {
      void session.start();
    }
  }, [auth, session]);

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

  if (auth === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Restoring session…
      </div>
    );
  }

  if (auth === "signed-out") {
    return (
      <div className="flex h-full items-center justify-center">
        <LoginForm
          onSignedIn={() => {
            setAuth("signed-in");
          }}
        />
      </div>
    );
  }

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
