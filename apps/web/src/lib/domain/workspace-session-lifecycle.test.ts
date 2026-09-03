import { InMemoryDomainStore } from "@openbento/domain";
import { describe, expect, it } from "vitest";
import { IdSequence } from "../../server/ids";
import { runDomainActionFromRequest } from "../../server/run-action";
import { requestAuthFromVerifiedUser } from "../../server/session";
import { WorkspaceSession } from "./workspace-session";
import {
  WorkspaceSessionBinder,
  principalIdFromAuthUser,
  shouldReplaceWorkspaceSession,
} from "./workspace-session-lifecycle";

const USER_A = "session-user-a";
const USER_B = "session-user-b";
const GUEST_OLD = "guest-owner-old";
const GUEST_NEW = "user-permanent1";

function createUiSession(ownerId: string): WorkspaceSession {
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

describe("principalIdFromAuthUser", () => {
  it("returns null for signed-out / missing user", () => {
    expect(principalIdFromAuthUser(null)).toBeNull();
    expect(principalIdFromAuthUser(undefined)).toBeNull();
    expect(principalIdFromAuthUser({ id: "" })).toBeNull();
    expect(principalIdFromAuthUser({ id: "   " })).toBeNull();
  });

  it("uses verified auth.uid() for permanent and anonymous principals", () => {
    expect(
      principalIdFromAuthUser({ id: USER_A, is_anonymous: false }),
    ).toBe(USER_A);
    expect(
      principalIdFromAuthUser({ id: "guest-1-anon", is_anonymous: true }),
    ).toBe("guest-1-anon");
  });
});

describe("shouldReplaceWorkspaceSession", () => {
  it("keeps the same principal bound", () => {
    expect(shouldReplaceWorkspaceSession(USER_A, USER_A)).toBe(false);
  });

  it("replaces on principal change including sign-out and guest transitions", () => {
    expect(shouldReplaceWorkspaceSession(USER_A, USER_B)).toBe(true);
    expect(shouldReplaceWorkspaceSession(USER_A, null)).toBe(true);
    expect(shouldReplaceWorkspaceSession(null, USER_A)).toBe(true);
    expect(shouldReplaceWorkspaceSession("guest-1", USER_A)).toBe(true);
    expect(shouldReplaceWorkspaceSession("guest-1", "guest-2")).toBe(true);
    expect(shouldReplaceWorkspaceSession(null, null)).toBe(false);
  });
});

describe("WorkspaceSessionBinder account-switch lifecycle", () => {
  it("same principal reuses the bound session (no unnecessary reset)", async () => {
    let created = 0;
    const binder = new WorkspaceSessionBinder(() => {
      created += 1;
      return createUiSession(USER_A);
    });

    const first = binder.bind(USER_A);
    const canvas = await first.execute("createCanvas", { name: "Keep" });
    const second = binder.bind(USER_A);

    expect(created).toBe(1);
    expect(second).toBe(first);
    expect(second.getSnapshot().canvases.map((c) => c.id)).toContain(canvas.id);
  });

  it("user A → user B creates/uses a fresh workspace session", () => {
    const sessions: WorkspaceSession[] = [];
    const binder = new WorkspaceSessionBinder(() => {
      const s = createUiSession(`owner-${sessions.length}-xx`);
      sessions.push(s);
      return s;
    });

    const a = binder.bind(USER_A);
    const b = binder.bind(USER_B);

    expect(sessions).toHaveLength(2);
    expect(a).toBe(sessions[0]);
    expect(b).toBe(sessions[1]);
    expect(a).not.toBe(b);
    expect(binder.getBoundPrincipalId()).toBe(USER_B);
  });

  it("user A cached Canvas state cannot appear for user B", async () => {
    let nextOwner = USER_A;
    const binder = new WorkspaceSessionBinder(() => createUiSession(nextOwner));

    const sessionA = binder.bind(USER_A);
    const canvasA = await sessionA.execute("createCanvas", {
      name: "User A private",
    });
    expect(sessionA.getSnapshot().canvases.some((c) => c.id === canvasA.id)).toBe(
      true,
    );

    nextOwner = USER_B;
    const sessionB = binder.bind(USER_B);

    expect(sessionB).not.toBe(sessionA);
    expect(binder.getBoundPrincipalId()).toBe(USER_B);
    expect(sessionB.getSnapshot().canvases).toEqual([]);
    expect(
      sessionB.getSnapshot().canvases.some((c) => c.id === canvasA.id),
    ).toBe(false);
    // Prior session object still holds its own memory, but is unbound and
    // must not be returned for the new principal.
    expect(binder.getSession()).toBe(sessionB);
  });

  it("sign-out retires prior workspace state", async () => {
    const binder = new WorkspaceSessionBinder(() => createUiSession(USER_A));
    const sessionA = binder.bind(USER_A);
    await sessionA.execute("createCanvas", { name: "Will retire" });
    expect(sessionA.getSnapshot().canvases.length).toBe(1);

    binder.retire();

    expect(binder.getSession()).toBeUndefined();
    expect(binder.getBoundPrincipalId()).toBeNull();

    const sessionAgain = binder.bind(USER_A);
    expect(sessionAgain).not.toBe(sessionA);
    expect(sessionAgain.getSnapshot().canvases).toEqual([]);
  });

  it("anonymous/guest principal change is handled safely", async () => {
    let owner = GUEST_OLD;
    const binder = new WorkspaceSessionBinder(() => createUiSession(owner));

    const guestSession = binder.bind(GUEST_OLD);
    const guestCanvas = await guestSession.execute("createCanvas", {
      name: "Guest scratch",
    });
    expect(
      guestSession.getSnapshot().canvases.some((c) => c.id === guestCanvas.id),
    ).toBe(true);

    // Guest signs out.
    binder.retire();
    expect(binder.getSession()).toBeUndefined();

    // New permanent (or new anonymous) principal must not see guest canvas.
    owner = GUEST_NEW;
    const permanent = binder.bind(GUEST_NEW);
    expect(permanent).not.toBe(guestSession);
    expect(permanent.getSnapshot().canvases).toEqual([]);
    expect(
      permanent.getSnapshot().canvases.some((c) => c.id === guestCanvas.id),
    ).toBe(false);
  });

  it("rejects empty principal ids (never trust blank client identity)", () => {
    const binder = new WorkspaceSessionBinder(() => createUiSession(USER_A));
    expect(() => binder.bind("")).toThrow(/principalId/i);
  });
});
