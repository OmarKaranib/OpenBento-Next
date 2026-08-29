import { DomainError } from "@openbento/domain";
import type { OwnerId } from "@openbento/domain";

/**
 * Session identity port. Never accept a client-supplied user id.
 *
 * Production later: Supabase Auth `getUser()` / `auth.uid()`.
 * This file is not wired to a hosted project.
 */
export interface AuthSessionPort {
  getOwnerId(): Promise<OwnerId | null>;
}

const unsetPort: AuthSessionPort = {
  async getOwnerId() {
    return null;
  },
};

let port: AuthSessionPort = unsetPort;

export function configureAuthSession(next: AuthSessionPort): void {
  port = next;
}

export function resetAuthSession(): void {
  port = unsetPort;
}

export async function requireSessionOwnerId(): Promise<OwnerId> {
  const ownerId = await port.getOwnerId();
  if (!ownerId) {
    throw new DomainError(
      "unauthenticated",
      "Not authenticated. Identity must come from the session, never from action input.",
    );
  }
  return ownerId;
}
