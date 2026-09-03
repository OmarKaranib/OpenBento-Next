/**
 * Visibility-aware poller for WorkspaceSession.syncExternalState().
 *
 * Not Realtime: the supabase_realtime publication has zero tables
 * (`cards`, `watch_bots`, `watch_bot_events` unpublished). Polling re-reads
 * via catalog `getCanvasState` on the authenticated web user-JWT path.
 *
 * One controller per session (module WeakMap). Ref-count so React Strict
 * Mode does not start a second timer. Stops on session.dispose() (binder
 * retire / principal change).
 */

import type { WorkspaceSession } from "./workspace-session";

export const EXTERNAL_CANVAS_REFRESH_INTERVAL_MS = 4000;

export type RefreshHost = {
  visibilityState: () => DocumentVisibilityState;
  onVisibilityChange: (handler: () => void) => () => void;
  onFocus: (handler: () => void) => () => void;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
};

type Controller = {
  session: WorkspaceSession;
  host: RefreshHost;
  refs: number;
  timer: unknown | null;
  inflight: boolean;
  stopped: boolean;
  unsubVisibility: () => void;
  unsubFocus: () => void;
  unsubDispose: () => void;
};

const controllers = new WeakMap<WorkspaceSession, Controller>();

export function browserRefreshHost(): RefreshHost {
  return {
    visibilityState: () => document.visibilityState,
    onVisibilityChange: (handler) => {
      document.addEventListener("visibilitychange", handler);
      return () => document.removeEventListener("visibilitychange", handler);
    },
    onFocus: (handler) => {
      window.addEventListener("focus", handler);
      return () => window.removeEventListener("focus", handler);
    },
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => {
      window.clearInterval(id as number);
    },
  };
}

function tick(controller: Controller): void {
  if (controller.stopped || controller.inflight) {
    return;
  }
  if (controller.session.isDisposed()) {
    stopController(controller);
    return;
  }
  if (controller.host.visibilityState() !== "visible") {
    return;
  }
  controller.inflight = true;
  void controller.session
    .syncExternalState()
    .catch(() => undefined)
    .finally(() => {
      controller.inflight = false;
    });
}

function startTimer(controller: Controller): void {
  if (controller.stopped || controller.timer != null) {
    return;
  }
  controller.timer = controller.host.setInterval(() => {
    tick(controller);
  }, EXTERNAL_CANVAS_REFRESH_INTERVAL_MS);
}

function stopTimer(controller: Controller): void {
  if (controller.timer == null) {
    return;
  }
  controller.host.clearInterval(controller.timer);
  controller.timer = null;
}

function onBecameVisible(controller: Controller): void {
  if (controller.stopped) {
    return;
  }
  startTimer(controller);
  tick(controller);
}

function onVisibilityChange(controller: Controller): void {
  if (controller.stopped) {
    return;
  }
  if (controller.host.visibilityState() === "visible") {
    onBecameVisible(controller);
    return;
  }
  stopTimer(controller);
}

function onWindowFocus(controller: Controller): void {
  if (controller.stopped) {
    return;
  }
  if (controller.host.visibilityState() !== "visible") {
    return;
  }
  startTimer(controller);
  tick(controller);
}

function stopController(controller: Controller): void {
  if (controller.stopped) {
    return;
  }
  controller.stopped = true;
  stopTimer(controller);
  controller.unsubVisibility();
  controller.unsubFocus();
  controller.unsubDispose();
  controllers.delete(controller.session);
}

/**
 * Start (or join) the single poller for `session`. Returns a release
 * function. The last release (or session.dispose) tears the controller down.
 */
export function acquireExternalCanvasRefresh(
  session: WorkspaceSession,
  host: RefreshHost = browserRefreshHost(),
): () => void {
  if (session.isDisposed()) {
    return () => undefined;
  }
  const existing = controllers.get(session);
  if (existing && !existing.stopped) {
    existing.refs += 1;
    return () => releaseController(existing);
  }
  const controller: Controller = {
    session,
    host,
    refs: 1,
    timer: null,
    inflight: false,
    stopped: false,
    unsubVisibility: () => undefined,
    unsubFocus: () => undefined,
    unsubDispose: () => undefined,
  };
  controller.unsubVisibility = host.onVisibilityChange(() => {
    onVisibilityChange(controller);
  });
  controller.unsubFocus = host.onFocus(() => {
    onWindowFocus(controller);
  });
  controller.unsubDispose = session.onDispose(() => {
    stopController(controller);
  });
  controllers.set(session, controller);
  if (host.visibilityState() === "visible") {
    startTimer(controller);
  }
  return () => releaseController(controller);
}

function releaseController(controller: Controller): void {
  if (controller.stopped) {
    return;
  }
  controller.refs -= 1;
  if (controller.refs <= 0) {
    stopController(controller);
  }
}

export function refreshControllerRefCount(
  session: WorkspaceSession,
): number {
  return controllers.get(session)?.refs ?? 0;
}

export function refreshControllerHasTimer(
  session: WorkspaceSession,
): boolean {
  const controller = controllers.get(session);
  return Boolean(controller && !controller.stopped && controller.timer != null);
}
