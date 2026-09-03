"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  AuthVerificationSequencer,
  WorkspaceSessionBinder,
  principalIdFromAuthUser,
  runVerifiedAuthBind,
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
import { useExternalCanvasRefresh } from "./use-external-canvas-refresh";

type WorkspaceContextValue = {
  session: WorkspaceSession;
  snapshot: SessionSnapshot;
  /** True when the Supabase session is an anonymous (guest) user. */
  isGuest: boolean;
  /** Signed-in account email when present. Guests typically have none. */
  accountEmail: string | null;
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
  accountEmail: string | null;
  session: WorkspaceSession | null;
} {
  const nextPrincipalId = principalIdFromAuthUser(user);
  if (!nextPrincipalId) {
    browserSessionBinder.retire();
    return {
      auth: "signed-out",
      isGuest: false,
      accountEmail: null,
      session: null,
    };
  }
  const nextSession = browserSessionBinder.bind(nextPrincipalId);
  return {
    auth: "signed-in",
    isGuest: isAnonymousUser(user),
    // Same verified getUser() result as bind — never JWT / session.user.
    accountEmail: user?.email ?? null,
    session: nextSession,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<"loading" | "signed-out" | "signed-in">(
    "loading",
  );
  const [isGuest, setIsGuest] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const verificationSequencerRef = useRef(new AuthVerificationSequencer());

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const sequencer = verificationSequencerRef.current;

    function applyUser(user: AuthUserLike | null) {
      const next = bindSessionForUser(user);
      setAuth(next.auth);
      setIsGuest(next.isGuest);
      setAccountEmail(next.accountEmail);
      setSession(next.session);
      if (next.session) {
        void next.session.start();
      }
    }

    function startVerifiedPrincipalCheck() {
      // Always derive identity from verified getUser() — never bind from the
      // onAuthStateChange JWT/session payload. Only the latest started check
      // may apply/bind when multiple verifications overlap.
      void runVerifiedAuthBind({
        sequencer,
        getUser: async () => {
          const { data } = await supabase.auth.getUser();
          return data.user ?? null;
        },
        apply: applyUser,
      });
    }

    startVerifiedPrincipalCheck();
    const { data } = supabase.auth.onAuthStateChange(() => {
      startVerifiedPrincipalCheck();
    });
    return () => {
      sequencer.invalidate();
      data.subscription.unsubscribe();
    };
  }, []);

  const snapshot = useSyncExternalStore(
    session ? session.subscribe : subscribeNone,
    session ? session.getSnapshot : getEmptySnapshot,
    getEmptySnapshot,
  );

  useExternalCanvasRefresh(session);

  const value = useMemo<WorkspaceContextValue | null>(() => {
    if (!session) {
      return null;
    }
    return {
      session,
      snapshot,
      isGuest,
      accountEmail,
      execute: (name, input, options) => session.execute(name, input, options),
      commit: (calls, options) => session.commit(calls, options),
      undo: () => session.undo(),
      redo: () => session.redo(),
    };
  }, [session, snapshot, isGuest, accountEmail]);

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
            void runVerifiedAuthBind({
              sequencer: verificationSequencerRef.current,
              getUser: async () => {
                const { data } = await supabase.auth.getUser();
                return data.user ?? null;
              },
              apply: (user) => {
                const next = bindSessionForUser(user);
                setAuth(next.auth);
                setIsGuest(next.isGuest);
                setAccountEmail(next.accountEmail);
                setSession(next.session);
                if (next.session) {
                  void next.session.start();
                }
              },
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
