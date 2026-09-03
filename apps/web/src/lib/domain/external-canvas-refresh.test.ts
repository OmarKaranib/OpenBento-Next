import { InMemoryDomainStore } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";
import { IdSequence } from "../../server/ids";
import { runDomainActionFromRequest } from "../../server/run-action";
import { requestAuthFromVerifiedUser } from "../../server/session";
import { WorkspaceSession } from "./workspace-session";
import { WorkspaceSessionBinder } from "./workspace-session-lifecycle";
import {
  EXTERNAL_CANVAS_REFRESH_INTERVAL_MS,
  acquireExternalCanvasRefresh,
  refreshControllerHasTimer,
  refreshControllerRefCount,
  type RefreshHost,
} from "./external-canvas-refresh";

function createUiSession(ownerId = "session-user"): WorkspaceSession {
  const box = {
    store: new InMemoryDomainStore(),
    ids: new IdSequence(),
  };
  return new WorkspaceSession({
    seedDefaultCanvas: false,
    runAction: (name, input) =>
      runDomainActionFromRequest(
        requestAuthFromVerifiedUser(ownerId),
        name,
        input,
        { store: box.store, id: box.ids.next },
      ),
    resetStore: () => {
      box.store = new InMemoryDomainStore();
      box.ids.rewind();
    },
  });
}

function createHost(initial: DocumentVisibilityState = "visible"): RefreshHost & {
  visibility: DocumentVisibilityState;
  visibilityHandlers: Array<() => void>;
  focusHandlers: Array<() => void>;
  intervals: Map<unknown, () => void>;
  nextId: number;
  advance: (ms: number) => void;
} {
  const intervals = new Map<unknown, { fn: () => void; ms: number; elapsed: number }>();
  const host = {
    visibility: initial,
    visibilityHandlers: [] as Array<() => void>,
    focusHandlers: [] as Array<() => void>,
    intervals: new Map<unknown, () => void>(),
    nextId: 1,
    visibilityState: () => host.visibility,
    onVisibilityChange: (handler: () => void) => {
      host.visibilityHandlers.push(handler);
      return () => {
        host.visibilityHandlers = host.visibilityHandlers.filter(
          (entry) => entry !== handler,
        );
      };
    },
    onFocus: (handler: () => void) => {
      host.focusHandlers.push(handler);
      return () => {
        host.focusHandlers = host.focusHandlers.filter((entry) => entry !== handler);
      };
    },
    setInterval: (fn: () => void, _ms: number) => {
      const id = host.nextId;
      host.nextId += 1;
      intervals.set(id, { fn, ms: _ms, elapsed: 0 });
      host.intervals.set(id, fn);
      return id;
    },
    clearInterval: (id: unknown) => {
      intervals.delete(id);
      host.intervals.delete(id);
    },
    advance: (ms: number) => {
      for (const timer of intervals.values()) {
        timer.elapsed += ms;
        if (timer.elapsed >= timer.ms) {
          const ticks = Math.floor(timer.elapsed / timer.ms);
          timer.elapsed %= timer.ms;
          for (let i = 0; i < ticks; i += 1) {
            timer.fn();
          }
        }
      }
    },
  };
  return host;
}

describe("external canvas refresh scheduler", () => {
  it("uses a 4s interval and a single timer under Strict Mode remount", async () => {
    const session = createUiSession();
    await session.execute("createCanvas", { name: "Poll" });
    const sync = vi.spyOn(session, "syncExternalState");
    const host = createHost("visible");

    const releaseA = acquireExternalCanvasRefresh(session, host);
    const releaseB = acquireExternalCanvasRefresh(session, host);
    expect(refreshControllerRefCount(session)).toBe(2);
    expect(host.intervals.size).toBe(1);
    expect(refreshControllerHasTimer(session)).toBe(true);

    host.advance(EXTERNAL_CANVAS_REFRESH_INTERVAL_MS);
    expect(sync).toHaveBeenCalledTimes(1);

    releaseA();
    expect(refreshControllerRefCount(session)).toBe(1);
    expect(host.intervals.size).toBe(1);

    releaseB();
    expect(refreshControllerRefCount(session)).toBe(0);
    expect(host.intervals.size).toBe(0);
  });

  it("does not poll while hidden and refreshes immediately on visible/focus", async () => {
    const session = createUiSession();
    await session.execute("createCanvas", { name: "Hidden" });
    const sync = vi.spyOn(session, "syncExternalState");
    const host = createHost("hidden");

    acquireExternalCanvasRefresh(session, host);
    expect(host.intervals.size).toBe(0);
    host.advance(EXTERNAL_CANVAS_REFRESH_INTERVAL_MS * 3);
    expect(sync).not.toHaveBeenCalled();

    host.visibility = "visible";
    for (const handler of host.visibilityHandlers) {
      handler();
    }
    expect(sync).toHaveBeenCalledTimes(1);
    await sync.mock.results.at(-1)?.value;
    expect(host.intervals.size).toBe(1);

    host.advance(EXTERNAL_CANVAS_REFRESH_INTERVAL_MS);
    expect(sync).toHaveBeenCalledTimes(2);
    await sync.mock.results.at(-1)?.value;

    host.visibility = "hidden";
    for (const handler of host.visibilityHandlers) {
      handler();
    }
    expect(host.intervals.size).toBe(0);
    host.advance(EXTERNAL_CANVAS_REFRESH_INTERVAL_MS * 2);
    expect(sync).toHaveBeenCalledTimes(2);

    host.visibility = "visible";
    for (const handler of host.visibilityHandlers) {
      handler();
    }
    expect(sync).toHaveBeenCalledTimes(3);
    await sync.mock.results.at(-1)?.value;

    for (const handler of host.focusHandlers) {
      handler();
    }
    expect(sync).toHaveBeenCalledTimes(4);
  });

  it("stops polling when the binder retires the session", async () => {
    const binder = new WorkspaceSessionBinder(() => createUiSession());
    const session = binder.bind("session-user");
    await session.execute("createCanvas", { name: "Retire" });
    const sync = vi.spyOn(session, "syncExternalState");
    const host = createHost("visible");
    acquireExternalCanvasRefresh(session, host);
    expect(host.intervals.size).toBe(1);

    binder.retire();
    expect(session.isDisposed()).toBe(true);
    expect(host.intervals.size).toBe(0);
    host.advance(EXTERNAL_CANVAS_REFRESH_INTERVAL_MS * 2);
    expect(sync).not.toHaveBeenCalled();
    expect(await session.syncExternalState()).toBe(false);
  });

  it("does not overlap ticks while a sync is in flight", async () => {
    const session = createUiSession();
    await session.execute("createCanvas", { name: "Overlap" });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    vi.spyOn(session, "syncExternalState").mockImplementation(async () => {
      started += 1;
      await gate;
      return true;
    });
    const host = createHost("visible");
    acquireExternalCanvasRefresh(session, host);
    host.advance(EXTERNAL_CANVAS_REFRESH_INTERVAL_MS);
    host.advance(EXTERNAL_CANVAS_REFRESH_INTERVAL_MS);
    expect(started).toBe(1);
    release();
  });
});
