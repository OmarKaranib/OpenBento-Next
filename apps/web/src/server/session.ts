import { DomainError } from "@openbento/domain";
import type { OwnerId } from "@openbento/domain";

/**
 * Per-request identity. Never accept a client-supplied user id on action JSON.
 *
 * Local/dev: httpOnly session cookie minted by the server (middleware or
 * `ensureLocalDevSession`). Production later: Supabase Auth `getUser()` /
 * `auth.uid()` from the same request cookies/headers. This file is not wired
 * to a hosted project and has no process-wide owner port.
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
};

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
};

export function localDevSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export function isUsableOwnerId(value: string): value is OwnerId {
  return OWNER_ID_PATTERN.test(value);
}

export function mintLocalDevOwnerId(): OwnerId {
  return crypto.randomUUID();
}

function cookieValueFromHeader(
  cookieHeader: string,
  name: string,
): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

/**
 * Resolve owner from THIS request's cookies/headers only.
 * Does not read a process-wide port. Ignores any client `ownerId` field.
 */
export function ownerIdFromRequest(
  request: RequestAuthContext,
): OwnerId | null {
  const fromCookie = request.cookies?.get(LOCAL_DEV_SESSION_COOKIE)?.value;
  if (fromCookie && isUsableOwnerId(fromCookie)) {
    return fromCookie;
  }

  const cookieHeader = request.headers?.get("cookie");
  if (cookieHeader) {
    const parsed = cookieValueFromHeader(cookieHeader, LOCAL_DEV_SESSION_COOKIE);
    if (parsed && isUsableOwnerId(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function requireOwnerIdFromRequest(
  request: RequestAuthContext,
): OwnerId {
  const ownerId = ownerIdFromRequest(request);
  if (!ownerId) {
    throw new DomainError(
      "unauthenticated",
      "Not authenticated. Identity must come from the session, never from action input.",
    );
  }
  return ownerId;
}

export function requestAuthFromOwnerCookie(
  ownerId: OwnerId,
): RequestAuthContext {
  return {
    cookies: {
      get(name: string) {
        return name === LOCAL_DEV_SESSION_COOKIE
          ? { value: ownerId }
          : undefined;
      },
    },
  };
}
