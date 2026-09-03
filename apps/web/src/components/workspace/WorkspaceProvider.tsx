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
  WorkspaceSessionBinder,
  principalIdFromAuthUser,
} from "@/lib/domain/workspace-session-lifecycle";
import {
  listOwnedCanvases,
  requireAuthenticatedSession,
  resetLocalWorkspace,
  runDomainAction,
} from "@/server/actions";
import { createBrowserSupabaseClient } from "@/server/supabase-browser";
import { EntryScreen } from "@/components/auth/EntryScreen";
import { isAnonymousUser, type AuthUserLike } from "@/lib/auth/guest";

type WorkspaceContextValue = {
  session: WorkspaceSession;
  snapshot: SessionSnapshot;
  /** True when the Supabase session is an anonymous (guest) user. */
  isGuest: boolean;
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

const EMPTY_SNAPSHOT: SessionSnapshot = {
  canvases: [],
  currentCanvasId: null,
  cards: [],
  frames: [],
  watchBots: [],
  fullscreen: null,
  canUndo: false,
  canRedo: false,
  revision: 0,
};

function createBrowserWorkspaceSession(): WorkspaceSession {
  return new WorkspaceSession({
    runAction: runDomainAction,
    resetStore: resetLocalWorkspace,
    prepare: requireAuthenticatedSession,
    restoreCanvases: listOwnedCanvases,
    replayOnReset: false,
  });
}

/**
 * Module-level binder: at most one live WorkspaceSession, keyed by verified
 * auth.uid(). Principal changes recreate the session so user A's Canvas cache
 * cannot survive an in-tab switch to user B.
 */
const browserSessionBinder = new WorkspaceSessionBinder(
  createBrowserWorkspaceSession,
);

function subscribeNone(): () => void {
  return () => undefined;
}

function getEmptySnapshot(): SessionSnapshot {
  return EMPTY_SNAPSHOT;
}

function bindSessionForUser(user: AuthUserLike | null): {
  auth: "signed-out" | "signed-in";
  isGuest: boolean;
  session: WorkspaceSession | null;
} {
  const nextPrincipalId = principalIdFromAuthUser(user);
  if (!nextPrincipalId) {
    browserSessionBinder.retire();
    return { auth: "signed-out", isGuest: false, session: null };
  }
  const nextSession = browserSessionBinder.bind(nextPrincipalId);
  return {
    auth: "signed-in",
    isGuest: isAnonymousUser(user),
    session: nextSession,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<"loading" | "signed-out" | "signed-in">(
    "loading",
  );
  const [isGuest, setIsGuest] = useState(false);
  const [session, setSession] = useState<WorkspaceSession | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    function applyUser(user: AuthUserLike | null) {
      if (cancelled) {
        return;
      }
      const next = bindSessionForUser(user);
      setAuth(next.auth);
      setIsGuest(next.isGuest);
      setSession(next.session);
      if (next.session) {
        void next.session.start();
      }
    }

    void supabase.auth.getUser().then(({ data }) => {
      applyUser(data.user ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange(() => {
      // Re-verify via getUser on every auth event — never bind from JWT alone.
      void supabase.auth.getUser().then(({ data: verified }) => {
        applyUser(verified.user ?? null);
      });
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const snapshot = useSyncExternalStore(
    session ? session.subscribe : subscribeNone,
    session ? session.getSnapshot : getEmptySnapshot,
    getEmptySnapshot,
  );

  const value = useMemo<WorkspaceContextValue | null>(() => {
    if (!session) {
      return null;
    }
    return {
      session,
      snapshot,
      isGuest,
      execute: (name, input, options) => session.execute(name, input, options),
      commit: (calls, options) => session.commit(calls, options),
      undo: () => session.undo(),
      redo: () => session.redo(),
    };
  }, [session, snapshot, isGuest]);

  if (auth === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Restoring session…
      </div>
    );
  }

  if (auth === "signed-out" || !value) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0b0d10] px-4">
        <EntryScreen
          onSignedIn={() => {
            const supabase = createBrowserSupabaseClient();
            void supabase.auth.getUser().then(({ data }) => {
              const next = bindSessionForUser(data.user ?? null);
              setAuth(next.auth);
              setIsGuest(next.isGuest);
              setSession(next.session);
              if (next.session) {
                void next.session.start();
              }
            });
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
