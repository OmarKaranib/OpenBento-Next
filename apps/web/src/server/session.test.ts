import { describe, expect, it } from "vitest";
import {
  LOCAL_DEV_SESSION_COOKIE,
  ownerIdFromRequest,
  requestAuthFromVerifiedUser,
  requireOwnerIdFromRequest,
} from "./session";

describe("per-request Supabase Auth identity", () => {
  it("fails when the request has no verified session", async () => {
    expect(await ownerIdFromRequest({})).toBeNull();
    await expect(
      requireOwnerIdFromRequest({
        cookies: { get: () => undefined },
        headers: { get: () => null },
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("resolves owner from auth.uid() / getUser(), not a process singleton", async () => {
    const a = await requireOwnerIdFromRequest(
      requestAuthFromVerifiedUser("session-user-a"),
    );
    const b = await requireOwnerIdFromRequest(
      requestAuthFromVerifiedUser("session-user-b"),
    );
    expect(a).toBe("session-user-a");
    expect(b).toBe("session-user-b");
  });

  it("ignores the unsigned ob_local_session cookie as a live path", async () => {
    expect(
      await ownerIdFromRequest({
        cookies: {
          get(name: string) {
            return name === LOCAL_DEV_SESSION_COOKIE
              ? { value: "cookie-forged-owner" }
              : undefined;
          },
        },
        headers: {
          get(name: string) {
            return name.toLowerCase() === "cookie"
              ? `${LOCAL_DEV_SESSION_COOKIE}=header-forged-owner`
              : null;
          },
        },
      }),
    ).toBeNull();
  });

  it("ignores a client-supplied owner header and ownerId-looking fields", async () => {
    expect(
      await ownerIdFromRequest({
        headers: {
          get(name: string) {
            if (name.toLowerCase() === "x-owner-id") return "attacker";
            if (name.toLowerCase() === "ownerid") return "attacker";
            return null;
          },
        },
      }),
    ).toBeNull();
  });

  it("does not export a process-wide configureAuthSession port", async () => {
    const session = await import("./session");
    expect(
      (session as { configureAuthSession?: unknown }).configureAuthSession,
    ).toBeUndefined();
    expect(
      (session as { resetAuthSession?: unknown }).resetAuthSession,
    ).toBeUndefined();
  });

  it("accepts getUser() as the authenticated session source", async () => {
    const ownerId = await requireOwnerIdFromRequest({
      getUser: async () => ({ id: "auth-uid-user-1" }),
    });
    expect(ownerId).toBe("auth-uid-user-1");
  });
});
