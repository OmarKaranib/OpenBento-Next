import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { InMemoryDomainStore } from "@openbento/domain";
import { describe, expect, it, vi } from "vitest";
import { IdSequence } from "../../server/ids";
import { runDomainActionFromRequest } from "../../server/run-action";
import { requestAuthFromVerifiedUser } from "../../server/session";
import { WorkspaceSession } from "../domain/workspace-session";
import {
  ANONYMOUS_SIGNIN_DISABLED_MESSAGE,
  GUEST_ENTRY_SUPPORT_COPY,
  GUEST_FALSE_PERMANENCE_PHRASES,
  GUEST_WORKSPACE_BODY,
  GUEST_WORKSPACE_TITLE,
  guestSignInErrorMessage,
  isAnonymousUser,
  tryOpenBentoAnonymously,
} from "./guest";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../..");

function readSrc(relative: string): string {
  return readFileSync(join(webSrc, relative), "utf8");
}

describe("guest auth helpers", () => {
  it("distinguishes anonymous guests from permanent users", () => {
    expect(isAnonymousUser({ id: "u1", is_anonymous: true })).toBe(true);
    expect(
      isAnonymousUser({ id: "u2", is_anonymous: false, email: "a@example.com" }),
    ).toBe(false);
    expect(isAnonymousUser(null)).toBe(false);
    expect(isAnonymousUser({ id: "u3" })).toBe(false);
  });

  it("maps anonymous-disabled provider errors to a fail-closed message", () => {
    expect(guestSignInErrorMessage({ message: "Anonymous sign-ins are disabled" })).toBe(
      ANONYMOUS_SIGNIN_DISABLED_MESSAGE,
    );
    expect(guestSignInErrorMessage(new Error("Signups not allowed for this instance"))).toBe(
      ANONYMOUS_SIGNIN_DISABLED_MESSAGE,
    );
  });

  it("Try OpenBento calls signInAnonymously and returns the session user", async () => {
    const signInAnonymously = vi.fn(async () => ({
      data: {
        user: { id: "anon-user-1", is_anonymous: true },
        session: { access_token: "t" },
      },
      error: null,
    }));
    const result = await tryOpenBentoAnonymously({
      auth: { signInAnonymously },
    });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(result.user.id).toBe("anon-user-1");
    expect(isAnonymousUser(result.user)).toBe(true);
  });

  it("fails closed when anonymous auth errors — no fabricated ownerId", async () => {
    await expect(
      tryOpenBentoAnonymously({
        auth: {
          signInAnonymously: async () => ({
            data: { user: null, session: null },
            error: { message: "Anonymous sign-ins are disabled" },
          }),
        },
      }),
    ).rejects.toThrow(ANONYMOUS_SIGNIN_DISABLED_MESSAGE);
  });

  it("fails closed when the provider returns no user id", async () => {
    await expect(
      tryOpenBentoAnonymously({
        auth: {
          signInAnonymously: async () => ({
            data: { user: null, session: null },
            error: null,
          }),
        },
      }),
    ).rejects.toThrow(ANONYMOUS_SIGNIN_DISABLED_MESSAGE);
  });
});

describe("guest entry UI source contracts", () => {
  it("signed-out visitor sees Try OpenBento + Sign in", () => {
    const entry = readSrc("components/auth/EntryScreen.tsx");
    expect(entry).toContain("Try OpenBento");
    expect(entry).toContain("Sign in");
    expect(entry).toContain("GUEST_ENTRY_SUPPORT_COPY");
    expect(entry).toContain("tryOpenBentoAnonymously");
    expect(entry).toContain("createBrowserSupabaseClient");
    const guest = readSrc("lib/auth/guest.ts");
    expect(guest).toContain("signInAnonymously");
    expect(guest).toContain(GUEST_ENTRY_SUPPORT_COPY);
  });

  it("WorkspaceProvider uses EntryScreen and tracks guest state", () => {
    const provider = readSrc("components/workspace/WorkspaceProvider.tsx");
    expect(provider).toContain("EntryScreen");
    expect(provider).toContain("isGuest");
    expect(provider).toContain("isAnonymousUser");
    expect(provider).not.toMatch(/LoginForm[\s\S]{0,40}signed-out|signed-out[\s\S]{0,80}LoginForm/);
    // Still routes through the existing authenticated session start path.
    expect(provider).toContain("requireAuthenticatedSession");
    expect(provider).toContain("listOwnedCanvases");
    expect(provider).not.toMatch(/ownerId\s*=\s*['"`]/);
    expect(provider).not.toMatch(/crypto\.randomUUID\(\)/);
    expect(provider).not.toMatch(/ob_local_session/);
  });

  it("guest Settings copy is honest about browser-tied persistence", () => {
    const panels = readSrc("components/shell/SidePanels.tsx");
    expect(panels).toContain(GUEST_WORKSPACE_TITLE);
    expect(panels).toContain(GUEST_WORKSPACE_BODY);
    expect(panels).toContain("isGuest");
    for (const phrase of GUEST_FALSE_PERMANENCE_PHRASES) {
      expect(panels).not.toContain(phrase);
    }
  });

  it("does not introduce a direct database guest bypass", () => {
    const guest = readSrc("lib/auth/guest.ts");
    const entry = readSrc("components/auth/EntryScreen.tsx");
    const provider = readSrc("components/workspace/WorkspaceProvider.tsx");
    for (const src of [guest, entry, provider]) {
      expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(src).not.toMatch(/\.from\(["']canvases/);
      expect(src).not.toMatch(/saveCanvas/);
      expect(src).not.toMatch(/createActionExecutor/);
    }
  });

  it("permanent LoginForm still uses email/password Auth", () => {
    const login = readSrc("components/auth/LoginForm.tsx");
    expect(login).toContain("signInWithPassword");
    expect(login).toContain("signUp");
    expect(login).not.toContain("signInAnonymously");
  });

  it("home route is force-dynamic to avoid cross-user static caching", () => {
    const page = readSrc("app/page.tsx");
    expect(page).toContain('dynamic = "force-dynamic"');
  });
});

describe("guest workspace session uses existing ownership path", () => {
  it("reload restores canvases without creating a duplicate", async () => {
    const store = new InMemoryDomainStore();
    const ids = new IdSequence();
    const guestOwner = "anon-guest-owner-1";

    const first = new WorkspaceSession({
      seedDefaultCanvas: false,
      runAction: (name, input) =>
        runDomainActionFromRequest(
          requestAuthFromVerifiedUser(guestOwner),
          name,
          input,
          { store, id: ids.next },
        ),
      resetStore: () => undefined,
    });
    const canvas = await first.execute("createCanvas", { name: "Guest Canvas" });
    expect(canvas.ownerId).toBe(guestOwner);

    const restored = new WorkspaceSession({
      seedDefaultCanvas: true,
      restoreCanvases: () => store.listCanvasesByOwner(guestOwner),
      runAction: (name, input) =>
        runDomainActionFromRequest(
          requestAuthFromVerifiedUser(guestOwner),
          name,
          input,
          { store, id: ids.next },
        ),
      resetStore: () => undefined,
      replayOnReset: false,
    });
    await restored.start();
    const snap = restored.getSnapshot();
    expect(snap.canvases).toHaveLength(1);
    expect(snap.canvases[0]?.id).toBe(canvas.id);
    expect(snap.currentCanvasId).toBe(canvas.id);
  });

  it("permanent user path still stamps ownerId from the verified session", async () => {
    const store = new InMemoryDomainStore();
    const ids = new IdSequence();
    const session = new WorkspaceSession({
      seedDefaultCanvas: false,
      runAction: (name, input) =>
        runDomainActionFromRequest(
          requestAuthFromVerifiedUser("permanent-user-1"),
          name,
          input,
          { store, id: ids.next },
        ),
      resetStore: () => undefined,
    });
    const canvas = await session.execute("createCanvas", { name: "Owned" });
    expect(canvas.ownerId).toBe("permanent-user-1");
    await expect(
      session.execute("createCanvas", {
        name: "Poison",
        ownerId: "attacker",
      } as never),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
