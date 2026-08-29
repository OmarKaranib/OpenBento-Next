import { DomainError } from "@openbento/domain";
import { describe, expect, it } from "vitest";
import {
  LOCAL_DEV_SESSION_COOKIE,
  ownerIdFromRequest,
  requestAuthFromOwnerCookie,
  requireOwnerIdFromRequest,
} from "./session";

describe("per-request session identity", () => {
  it("fails when the request has no session cookie", () => {
    expect(ownerIdFromRequest({})).toBeNull();
    try {
      requireOwnerIdFromRequest({
        cookies: { get: () => undefined },
        headers: { get: () => null },
      });
      throw new Error("expected unauthenticated");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ code: "unauthenticated" });
    }
  });

  it("resolves owner from this request's cookie, not a process singleton", () => {
    const a = requireOwnerIdFromRequest(requestAuthFromOwnerCookie("session-user-a"));
    const b = requireOwnerIdFromRequest(requestAuthFromOwnerCookie("session-user-b"));
    expect(a).toBe("session-user-a");
    expect(b).toBe("session-user-b");
  });

  it("reads the session token from the Cookie header when cookies() is absent", () => {
    const ownerId = requireOwnerIdFromRequest({
      headers: {
        get(name: string) {
          return name.toLowerCase() === "cookie"
            ? `${LOCAL_DEV_SESSION_COOKIE}=header-owner-1`
            : null;
        },
      },
    });
    expect(ownerId).toBe("header-owner-1");
  });

  it("ignores a client-supplied owner header and ownerId-looking fields", () => {
    expect(
      ownerIdFromRequest({
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
});
