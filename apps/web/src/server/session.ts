import { DomainError } from "@openbento/domain";
import type { OwnerId } from "@openbento/domain";

/**
 * Per-request identity from Supabase Auth (`auth.uid()` / `getUser()`).
 * Never accept a client-supplied user id on action JSON.
 * The unsigned `ob_local_session` cookie is not the live path.
 */
export const LOCAL_DEV_SESSION_COOKIE = "ob_local_session";

const OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export type HeaderReader = {
  get(name: string): string | null;
};

export type RequestAuthContext = {
  cookies?: CookieReader;
  headers?: HeaderReader;
  /**
   * Already-verified `auth.uid()` from `supabase.auth.getUser()`.
   * Server-populated only. Tests inject this. Never a client field.
   */
  verifiedUserId?: OwnerId;
  getUser?: () => Promise<{ id: string } | null>;
};

export function isUsableOwnerId(value: string): value is OwnerId {
  return OWNER_ID_PATTERN.test(value);
}

/**
 * Resolve owner from THIS request's authenticated session only.
 * Does not read a process-wide port. Ignores client `ownerId` and
 * the unsigned `ob_local_session` cookie.
 */
export async function ownerIdFromRequest(
  request: RequestAuthContext,
): Promise<OwnerId | null> {
  if (request.verifiedUserId && isUsableOwnerId(request.verifiedUserId)) {
    return request.verifiedUserId;
  }

  if (request.getUser) {
    const user = await request.getUser();
    if (user?.id && isUsableOwnerId(user.id)) {
      return user.id;
    }
  }

  return null;
}

export async function requireOwnerIdFromRequest(
  request: RequestAuthContext,
): Promise<OwnerId> {
  const ownerId = await ownerIdFromRequest(request);
  if (!ownerId) {
    throw new DomainError(
      "unauthenticated",
      "Not authenticated. Identity must come from the Supabase Auth session (auth.uid()), never from action input.",
    );
  }
  return ownerId;
}

/** Isolated tests: inject a verified auth.uid(), not an unsigned cookie. */
export function requestAuthFromVerifiedUser(
  ownerId: OwnerId,
): RequestAuthContext {
  return {
    verifiedUserId: ownerId,
    getUser: async () => ({ id: ownerId }),
  };
}

/** @deprecated Use requestAuthFromVerifiedUser. Kept so old test names fail closed. */
export function requestAuthFromOwnerCookie(
  ownerId: OwnerId,
): RequestAuthContext {
  return requestAuthFromVerifiedUser(ownerId);
}
